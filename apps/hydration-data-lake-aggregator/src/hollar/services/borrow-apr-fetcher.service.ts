import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  MultiEndpointGraphqlService,
} from '../../graphql-client/services/multi-endpoint-graphql.service';
import {
  GET_BORROW_APR_TRANSFERS_QUERY,
} from '../../graphql-client/queries/borrow-apr.queries';
import {
  BorrowAprTransferNode,
  GetBorrowAprTransfersResponse,
} from '../../graphql-client/types/graphql-response.types';
import { FetchResult } from '../../common/interfaces/paginated-response.interface';

@Injectable()
export class BorrowAprFetcherService {
  private readonly logger = new Logger(BorrowAprFetcherService.name);

  constructor(private graphqlClient: MultiEndpointGraphqlService) {}

  /**
   * Fetch Borrow APR transfers by iterating reaper endpoints sequentially
   * in block order, accumulating up to batchSize transfers.
   *
   * Strategy:
   * - Sort endpoints by fromBlockHeight ASC
   * - Skip endpoints whose entire block range is <= fromBlock
   * - For each endpoint, query with: fromBlock > max(fromBlock, endpoint.fromBlockHeight-1)
   *   and toBlock <= min(endpoint.toBlockHeight, currentBlock)
   * - Accumulate results until batchSize is reached, then stop
   * - Falls back to fallback URL if multi-endpoint mode is disabled
   *
   * @param fromBlock - Last processed block (exclusive)
   * @param currentBlock - Current chain tip block (upper bound for all queries)
   * @param batchSize - Max transfers to accumulate across all endpoints
   * @returns Accumulated transfers and combined totalCount
   */
  async fetchBorrowAprTransfers(
    fromBlock: number,
    currentBlock: number,
    batchSize: number = 1000,
  ): Promise<FetchResult<BorrowAprTransferNode>> {
    this.logger.debug(
      `Fetching Borrow APR transfers after block ${fromBlock} up to ${currentBlock} (limit: ${batchSize})`,
    );

    const config = this.graphqlClient.getConfig();

    // If multi-endpoint mode is disabled, use fallback directly
    if (!config.enabled || config.endpoints.length === 0) {
      return this.fetchFromSingleEndpoint(config.fallbackUrl, fromBlock, currentBlock, batchSize);
    }

    // Sort endpoints by fromBlockHeight ASC to process in chronological order
    const endpoints = [...config.endpoints].sort(
      (a, b) => a.fromBlockHeight - b.fromBlockHeight,
    );

    const accumulated: BorrowAprTransferNode[] = [];
    let totalCount = 0;

    for (const endpoint of endpoints) {
      // Skip endpoints whose entire range is already processed
      if (endpoint.toBlockHeight <= fromBlock) {
        continue;
      }

      const remaining = batchSize - accumulated.length;
      if (remaining <= 0) {
        break;
      }

      // The effective fromBlock for this endpoint is the higher of the two
      const effectiveFromBlock = Math.max(fromBlock, endpoint.fromBlockHeight - 1);
      // Cap toBlock at currentBlock — valid 32-bit int and avoids over-fetching
      const effectiveToBlock = Math.min(endpoint.toBlockHeight, currentBlock);

      this.logger.debug(
        `Querying endpoint ${endpoint.apiUrl} for blocks ${effectiveFromBlock + 1}-${effectiveToBlock} (remaining: ${remaining})`,
      );

      const result = await this.fetchFromSingleEndpoint(
        endpoint.apiUrl,
        effectiveFromBlock,
        effectiveToBlock,
        remaining,
      );

      if (result.items.length > 0) {
        accumulated.push(...result.items);
        totalCount += result.totalCount;
        this.logger.debug(
          `Endpoint ${endpoint.apiUrl} returned ${result.items.length} transfers (accumulated: ${accumulated.length}/${batchSize})`,
        );
      }

      if (accumulated.length >= batchSize) {
        break;
      }
    }

    this.logger.log(
      `Fetched ${accumulated.length} Borrow APR transfers (total: ${totalCount})`,
    );

    return { items:accumulated, totalCount };
  }

  private async fetchFromSingleEndpoint(
    endpointUrl: string,
    fromBlock: number,
    toBlock: number,
    limit: number,
  ): Promise<FetchResult<BorrowAprTransferNode>> {
    const variables = {
      fromBlock,
      toBlock,
      first: limit,
    };

    try {
      const response =
        await this.graphqlClient.querySingleEndpoint<GetBorrowAprTransfersResponse>(
          endpointUrl,
          GET_BORROW_APR_TRANSFERS_QUERY,
          variables,
        );

      return {
        items:response.transfers.nodes,
        totalCount: response.transfers.totalCount,
      };
    } catch (error) {
      this.logger.warn(
        `Endpoint ${endpointUrl} failed for blocks ${fromBlock}-${toBlock}: ${error.message}`,
      );
      return { items:[], totalCount: 0 };
    }
  }

}

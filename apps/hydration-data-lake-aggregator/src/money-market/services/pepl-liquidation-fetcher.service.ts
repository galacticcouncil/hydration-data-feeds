import { Injectable, Logger } from '@nestjs/common';

import { MultiEndpointGraphqlService } from '../../graphql-client/services/multi-endpoint-graphql.service';
import { GET_PEPL_LIQUIDATION_EVENTS_QUERY } from '../../graphql-client/queries/pepl-liquidation.queries';
import {
  GetPeplLiquidationEventsResponse,
  PeplLiquidationEventNode,
} from '../../graphql-client/types/graphql-response.types';
import { FetchResult } from '../../common/interfaces/paginated-response.interface';

/**
 * Service responsible for fetching PEPL liquidation events from GraphQL.
 * Iterates reaper endpoints sequentially in block order, accumulating up to
 * batchSize events — mirrors the BorrowAprFetcherService strategy.
 */
@Injectable()
export class PeplLiquidationFetcherService {
  private readonly logger = new Logger(PeplLiquidationFetcherService.name);

  constructor(private graphqlClient: MultiEndpointGraphqlService) {}

  /**
   * Fetch PEPL liquidation events by iterating reaper endpoints sequentially
   * in block order, accumulating up to batchSize events.
   *
   * Strategy:
   * - Sort endpoints by fromBlockHeight ASC
   * - Skip endpoints whose entire block range is <= fromBlock
   * - For each endpoint, query with: fromBlock > max(fromBlock, endpoint.fromBlockHeight-1)
   *   and toBlock <= min(endpoint.toBlockHeight, currentBlock)
   * - Accumulate results until batchSize is reached, then stop
   *
   * @param fromBlock - Last processed block (exclusive)
   * @param currentBlock - Current chain tip block (upper bound for all queries)
   * @param batchSize - Max events to accumulate across all endpoints
   * @returns Accumulated events and combined totalCount
   */
  async fetchPeplLiquidationEvents(
    fromBlock: number,
    currentBlock: number,
    batchSize: number = 500,
  ): Promise<FetchResult<PeplLiquidationEventNode>> {
    this.logger.debug(
      `Fetching PEPL liquidations after block ${fromBlock} up to ${currentBlock} (limit: ${batchSize})`,
    );

    const config = this.graphqlClient.getConfig();

    // If multi-endpoint mode is disabled, use fallback directly
    if (!config.enabled || config.endpoints.length === 0) {
      return this.fetchFromSingleEndpoint(
        config.fallbackUrl,
        fromBlock,
        currentBlock,
        batchSize,
      );
    }

    // Sort endpoints by fromBlockHeight ASC to process in chronological order
    const endpoints = [...config.endpoints].sort(
      (a, b) => a.fromBlockHeight - b.fromBlockHeight,
    );

    const accumulated: PeplLiquidationEventNode[] = [];
    let totalCount = 0;

    for (const endpoint of endpoints) {
      // Skip endpoints whose entire range is already processed
      if (endpoint.toBlockHeight <= fromBlock) {
        continue;
      }

      // Stop if this endpoint starts beyond current block
      if (endpoint.fromBlockHeight > currentBlock) {
        break;
      }

      const remaining = batchSize - accumulated.length;
      if (remaining <= 0) {
        break;
      }

      const effectiveFromBlock = Math.max(fromBlock, endpoint.fromBlockHeight - 1);
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
          `Endpoint ${endpoint.apiUrl} returned ${result.items.length} events (accumulated: ${accumulated.length}/${batchSize})`,
        );
      }

      if (accumulated.length >= batchSize) {
        break;
      }
    }

    this.logger.log(
      `Fetched ${accumulated.length} PEPL liquidation events (total: ${totalCount})`,
    );

    return { items:accumulated, totalCount };
  }

  private async fetchFromSingleEndpoint(
    endpointUrl: string,
    fromBlock: number,
    toBlock: number,
    limit: number,
  ): Promise<FetchResult<PeplLiquidationEventNode>> {
    const variables = {
      fromBlock,
      toBlock,
      first: limit,
    };

    try {
      const response =
        await this.graphqlClient.querySingleEndpoint<GetPeplLiquidationEventsResponse>(
          endpointUrl,
          GET_PEPL_LIQUIDATION_EVENTS_QUERY,
          variables,
        );

      return {
        items:response.liquidationLiquidatedEvents.nodes,
        totalCount: response.liquidationLiquidatedEvents.totalCount,
      };
    } catch (error) {
      this.logger.error(
        `Endpoint ${endpointUrl} failed for blocks ${fromBlock}-${toBlock}: ${error.message}`,
        error.stack,
      );
      // Re-throw so the orchestrator marks the service as errored and retries
      // without advancing lastProcessedBlock past the failed range
      throw error;
    }
  }

}

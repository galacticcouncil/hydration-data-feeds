import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  GraphqlClientService,
} from '../../graphql-client/graphql-client.service';
import {
  GET_AAVE_FACILITATOR_HISTORICAL_DATA_QUERY,
  GET_ACCOUNT_TOTAL_BALANCE_HISTORICAL_DATA_QUERY,
} from '../../graphql-client/queries/hsm-revenue.queries';
import {
  AaveFacilitatorHistoricalDataNode,
  GetAaveFacilitatorHistoricalDataResponse,
  GetAccountTotalBalanceHistoricalDataResponse,
} from '../../graphql-client/types/graphql-response.types';

export interface FetchedHsmRevenueData {
  facilitatorEvents: AaveFacilitatorHistoricalDataNode[];
  accountBalances: Map<number, string>; // paraBlockHeight -> totalTransferableNorm
  totalCount: number;
}

/**
 * Service responsible for fetching HSM revenue data from both GraphQL sources
 * Follows dual-query pattern: aaveFacilitatorHistoricalData + accountTotalBalanceHistoricalData
 */
@Injectable()
export class HsmRevenueFetcherService {
  private readonly logger = new Logger(HsmRevenueFetcherService.name);
  private readonly CONSTANT_ACCOUNT_ID =
    '0x6d6f646c70792f68736d6f640000000000000000000000000000000000000000';
  private readonly FACILITATOR_ID = '0x6d6f646c70792f68736d6f640000000000000000'

  constructor(private graphqlClient: GraphqlClientService) {}

  /**
   * Fetch HSM revenue data from both GraphQL sources
   *
   * Step 1: Fetch aave facilitator data (batch of records)
   * Step 2: Fetch account balances for unique block heights
   *
   * @param fromBlock - Last processed block (exclusive)
   * @param batchSize - Number of facilitator records to fetch (default: 100)
   * @returns Combined data from both queries
   */
  async fetchHsmRevenueData(
    fromBlock: number,
    batchSize: number = 100,
  ): Promise<FetchedHsmRevenueData> {
    this.logger.debug(
      `Fetching HSM revenue data after block ${fromBlock} (limit: ${batchSize})`,
    );

    // Step 1: Fetch aave facilitator historical data
    const facilitatorResponse =
      await this.graphqlClient.query<GetAaveFacilitatorHistoricalDataResponse>(
        GET_AAVE_FACILITATOR_HISTORICAL_DATA_QUERY,
        { facilitatorId: this.FACILITATOR_ID, fromBlock, first: batchSize },
      );

    const facilitatorEvents =
      facilitatorResponse.aaveFacilitatorHistoricalData.nodes;
    const totalCount =
      facilitatorResponse.aaveFacilitatorHistoricalData.totalCount;

    if (facilitatorEvents.length === 0) {
      this.logger.log('No aave facilitator events found');
      return {
        facilitatorEvents: [],
        accountBalances: new Map(),
        totalCount: 0,
      };
    }

    this.logger.log(
      `Fetched ${facilitatorEvents.length} aave facilitator events (total: ${totalCount})`,
    );

    // Step 2: Fetch account balances for unique block heights
    const uniqueBlockHeights =
      this.extractUniqueBlockHeights(facilitatorEvents);
    const accountBalances =
      await this.fetchAccountBalancesForBlocks(uniqueBlockHeights);

    this.logger.log(
      `Fetched account balances for ${accountBalances.size}/${uniqueBlockHeights.length} blocks`,
    );

    return { facilitatorEvents, accountBalances, totalCount };
  }

  /**
   * Extract unique block heights from facilitator events
   */
  private extractUniqueBlockHeights(
    events: AaveFacilitatorHistoricalDataNode[],
  ): number[] {
    const blockSet = new Set<number>();
    events.forEach((event) => blockSet.add(event.paraBlockHeight));
    return Array.from(blockSet).sort((a, b) => a - b);
  }

  /**
   * Fetch account balances for multiple block heights in a single batch query
   * Much more efficient than querying each block individually (1 query vs 100 queries)
   */
  private async fetchAccountBalancesForBlocks(
    blockHeights: number[],
  ): Promise<Map<number, string>> {
    const balanceMap = new Map<number, string>();

    if (blockHeights.length === 0) {
      return balanceMap;
    }

    this.logger.debug(
      `Fetching account balances for ${blockHeights.length} unique blocks in single batch query`,
    );

    try {
      const response =
        await this.graphqlClient.query<GetAccountTotalBalanceHistoricalDataResponse>(
          GET_ACCOUNT_TOTAL_BALANCE_HISTORICAL_DATA_QUERY,
          {
            accountId: this.CONSTANT_ACCOUNT_ID,
            blockHeights,
          },
        );

      const nodes = response.accountTotalBalanceHistoricalData.nodes;

      // Map results by block height
      nodes.forEach((node) => {
        balanceMap.set(node.paraBlockHeight, node.totalTransferableNorm);
      });

      // Log missing blocks
      const missingBlocks = blockHeights.filter(
        (height) => !balanceMap.has(height),
      );
      if (missingBlocks.length > 0) {
        this.logger.warn(
          `No account balance found for ${missingBlocks.length}/${blockHeights.length} blocks: ${missingBlocks.slice(0, 10).join(', ')}${missingBlocks.length > 10 ? '...' : ''}`,
        );
      }

      this.logger.debug(
        `Successfully fetched account balances for ${balanceMap.size}/${blockHeights.length} blocks`,
      );

      return balanceMap;
    } catch (error) {
      this.logger.error(
        `Failed to fetch account balances in batch: ${error.message}`,
        error.stack,
      );
      return balanceMap;
    }
  }

  /**
   * Get highest block height from batch of events
   * Used for state tracking
   */
  getMaxBlockHeight(events: AaveFacilitatorHistoricalDataNode[]): number {
    return Math.max(...events.map((e) => e.paraBlockHeight));
  }
}

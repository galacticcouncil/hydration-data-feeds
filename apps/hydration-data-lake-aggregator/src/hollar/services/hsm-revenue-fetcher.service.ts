import { Injectable, Logger } from '@nestjs/common';

import { GraphqlClientService } from '../../graphql-client/graphql-client.service';
import {
  GET_AAVE_FACILITATOR_HISTORICAL_DATA_QUERY,
  GET_ACCOUNT_TOTAL_BALANCE_HISTORICAL_DATA_QUERY,
  GET_MOST_RECENT_ACCOUNT_BALANCE_QUERY,
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
  private readonly FACILITATOR_ID =
    '0x6d6f646c70792f68736d6f640000000000000000';

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
   * Uses hybrid approach:
   * 1. Primary query: Fetch exact matches using IN operator (fast)
   * 2. Fallback query: For missing blocks, fetch most recent balance using lessThanOrEqualTo
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
      // Primary query: Fetch exact matches
      const response =
        await this.graphqlClient.query<GetAccountTotalBalanceHistoricalDataResponse>(
          GET_ACCOUNT_TOTAL_BALANCE_HISTORICAL_DATA_QUERY,
          {
            accountId: this.CONSTANT_ACCOUNT_ID,
            blockHeights,
          },
        );

      console.dir(response, { depth: null });

      const nodes = response.accountTotalBalanceHistoricalData.nodes;

      // Map results by block height
      nodes.forEach((node) => {
        balanceMap.set(node.paraBlockHeight, node.totalTransferableNorm);
      });

      // Find missing blocks
      const missingBlocks = blockHeights.filter(
        (height) => !balanceMap.has(height),
      );

      if (missingBlocks.length > 0) {
        this.logger.debug(
          `No exact match for ${missingBlocks.length}/${blockHeights.length} blocks, fetching most recent balances`,
        );

        // Fallback query: Fetch most recent balance for each missing block
        await this.fetchFallbackBalances(missingBlocks, balanceMap);
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
   * Fallback method to fetch the most recent balance for blocks with no exact match
   * Queries for balance at or before the requested block height
   *
   * Uses individual queries for each missing block to get the most recent balance
   * This is acceptable since missing blocks are typically rare (<5%)
   */
  private async fetchFallbackBalances(
    missingBlocks: number[],
    balanceMap: Map<number, string>,
  ): Promise<void> {
    if (missingBlocks.length === 0) return;

    // Query each missing block individually to get most recent balance
    const fallbackPromises = missingBlocks.map(async (blockHeight) => {
      try {
        const response =
          await this.graphqlClient.query<GetAccountTotalBalanceHistoricalDataResponse>(
            GET_MOST_RECENT_ACCOUNT_BALANCE_QUERY,
            {
              accountId: this.CONSTANT_ACCOUNT_ID,
              maxBlockHeight: blockHeight,
            },
          );

        const nodes = response.accountTotalBalanceHistoricalData.nodes;

        if (nodes.length > 0) {
          const mostRecentBalance = nodes[0];
          balanceMap.set(blockHeight, mostRecentBalance.totalTransferableNorm);
          this.logger.debug(
            `Using balance from block ${mostRecentBalance.paraBlockHeight} for missing block ${blockHeight}`,
          );
          return { blockHeight, found: true };
        } else {
          this.logger.warn(
            `No fallback balance found for block ${blockHeight}`,
          );
          return { blockHeight, found: false };
        }
      } catch (error) {
        this.logger.error(
          `Failed to fetch fallback balance for block ${blockHeight}: ${error.message}`,
        );
        return { blockHeight, found: false };
      }
    });

    const results = await Promise.all(fallbackPromises);
    const stillMissing = results
      .filter((r) => !r.found)
      .map((r) => r.blockHeight);

    if (stillMissing.length > 0) {
      this.logger.warn(
        `Still missing balances for ${stillMissing.length}/${missingBlocks.length} blocks after fallback: ${stillMissing.slice(0, 10).join(', ')}${stillMissing.length > 10 ? '...' : ''}`,
      );
    } else {
      this.logger.log(
        `Successfully fetched fallback balances for all ${missingBlocks.length} missing blocks`,
      );
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

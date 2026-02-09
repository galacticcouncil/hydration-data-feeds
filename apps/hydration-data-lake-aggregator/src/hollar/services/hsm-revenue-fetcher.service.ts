import { Injectable, Logger } from '@nestjs/common';

import { MultiEndpointGraphqlService } from '../../graphql-client/services/multi-endpoint-graphql.service';
import {
  GET_AAVE_FACILITATOR_HISTORICAL_DATA_QUERY,
  GET_ACCOUNT_TOTAL_BALANCE_HISTORICAL_DATA_QUERY,
  GET_MOST_RECENT_ACCOUNT_BALANCE_QUERY,
} from '../../graphql-client/queries/hsm-revenue.queries';
import {
  AaveFacilitatorHistoricalDataNode,
  GetAaveFacilitatorHistoricalDataResponse,
  GetAccountTotalBalanceHistoricalDataResponse,
  AccountTotalBalanceHistoricalDataNode,
} from '../../graphql-client/types/graphql-response.types';
import { NormalizedEndpointConfig } from '../../graphql-client/types/endpoint.types';

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

  constructor(private graphqlClient: MultiEndpointGraphqlService) {}

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
   * Enhanced with multi-endpoint support: If balance not found in the target endpoint,
   * sequentially queries previous endpoints until balance is found
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
        this.logger.debug(
          `[Fallback] Querying for nearest balance at or before block ${blockHeight}`,
        );

        // Try primary query first (existing behavior - uses multi-endpoint routing)
        const response =
          await this.graphqlClient.query<GetAccountTotalBalanceHistoricalDataResponse>(
            GET_MOST_RECENT_ACCOUNT_BALANCE_QUERY,
            {
              accountId: this.CONSTANT_ACCOUNT_ID,
              maxBlockHeight: blockHeight,
            },
          );

        const nodes = response.accountTotalBalanceHistoricalData.nodes;

        this.logger.debug(
          `[Fallback] Primary query returned ${nodes.length} nodes for block ${blockHeight}`,
        );

        if (nodes.length > 0) {
          // Log all returned nodes for debugging
          if (nodes.length > 1) {
            this.logger.debug(
              `[Fallback] All nodes returned: ${nodes.map((n) => `block ${n.paraBlockHeight}`).join(', ')}`,
            );
          }

          // Found balance in primary query (same endpoint or correct routing)
          const mostRecentBalance = nodes[0];
          balanceMap.set(blockHeight, mostRecentBalance.totalTransferableNorm);
          this.logger.debug(
            `[Fallback] ✓ Using balance from block ${mostRecentBalance.paraBlockHeight} for missing block ${blockHeight} (via primary query)`,
          );
          return { blockHeight, found: true };
        }

        // NOT FOUND in primary query - Need to query previous endpoints sequentially
        // This handles the case where the nearest balance is in a different endpoint
        this.logger.debug(
          `No balance found in primary query for block ${blockHeight}, trying sequential endpoint fallback`,
        );

        // Get all endpoints covering [0, blockHeight] in reverse chronological order
        const endpoints = this.getEndpointsForFallbackQuery(blockHeight);

        for (const endpoint of endpoints) {
          const result = await this.queryEndpointForNearestBalance(
            endpoint,
            blockHeight,
          );

          if (result) {
            balanceMap.set(blockHeight, result.totalTransferableNorm);
            this.logger.debug(
              `Using balance from block ${result.paraBlockHeight} (endpoint ${endpoint.apiUrl}) for missing block ${blockHeight} via sequential fallback`,
            );
            return { blockHeight, found: true };
          }
        }

        // Still not found after checking all endpoints
        this.logger.warn(
          `No fallback balance found for block ${blockHeight} after checking all ${endpoints.length} endpoints`,
        );
        return { blockHeight, found: false };
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
   * Get endpoints that cover blocks [0, maxBlock] in reverse chronological order
   * Allows querying for nearest balance across endpoint boundaries
   *
   * @param maxBlock - Maximum block height to query up to
   * @returns Array of endpoints sorted newest first
   */
  private getEndpointsForFallbackQuery(
    maxBlock: number,
  ): NormalizedEndpointConfig[] {
    const config = this.graphqlClient.getConfig();

    if (!config.enabled) {
      // Single-endpoint mode - return fallback endpoint
      return [
        {
          apiUrl: config.fallbackUrl,
          fromBlockHeight: 0,
          toBlockHeight: Number.MAX_SAFE_INTEGER,
          isHeadEndpoint: true,
        },
      ];
    }

    // Filter endpoints that cover blocks <= maxBlock and sort newest first
    return config.endpoints
      .filter((ep) => ep.fromBlockHeight <= maxBlock)
      .sort((a, b) => b.fromBlockHeight - a.fromBlockHeight);
  }

  /**
   * Query a specific endpoint for nearest balance at or before blockHeight
   * Bypasses multi-endpoint routing to query a single endpoint directly
   *
   * @param endpoint - Endpoint configuration to query
   * @param maxBlockHeight - Maximum block height to look for balance
   * @returns Balance node if found, null otherwise
   */
  private async queryEndpointForNearestBalance(
    endpoint: NormalizedEndpointConfig,
    maxBlockHeight: number,
  ): Promise<AccountTotalBalanceHistoricalDataNode | null> {
    try {
      const response =
        await this.graphqlClient.querySingleEndpoint<GetAccountTotalBalanceHistoricalDataResponse>(
          endpoint.apiUrl,
          GET_MOST_RECENT_ACCOUNT_BALANCE_QUERY,
          {
            accountId: this.CONSTANT_ACCOUNT_ID,
            maxBlockHeight,
          },
        );

      const nodes = response.accountTotalBalanceHistoricalData.nodes;
      return nodes.length > 0 ? nodes[0] : null;
    } catch (error) {
      this.logger.warn(
        `Failed to query endpoint ${endpoint.apiUrl} for balance at/before block ${maxBlockHeight}: ${error.message}`,
      );
      return null;
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

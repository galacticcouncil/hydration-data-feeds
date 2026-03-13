import { Injectable, Logger } from '@nestjs/common';

import { GraphqlClientService } from '../../graphql-client/services/graphql-client.service';
import {
  GET_SWAPS_QUERY,
  GET_ROUTED_TRADES_QUERY,
} from '../../graphql-client/queries/swaps.queries';
import {
  GetSwapsResponse,
  GetRoutedTradesResponse,
  SwapNode,
  RoutedTradeNode,
} from '../../graphql-client/types/graphql-response.types';
import { ConfigService } from '@nestjs/config';
import { AssetPriceMap, PriceFetcherService } from '../../common/services/price-fetcher.service';
import { FetchResult } from '../../common/interfaces/paginated-response.interface';

// Re-export for callers that import AssetPriceMap from this module
export type { AssetPriceMap };

// Union type to handle both legacy swaps and new routed trades
export type SwapOrRoutedTradeNode = SwapNode | RoutedTradeNode;

// Type guard to check if node is a RoutedTradeNode
export function isRoutedTradeNode(
  node: SwapOrRoutedTradeNode,
): node is RoutedTradeNode {
  return 'inputAssetIds' in node && 'outputAssetIds' in node && 'swaps' in node;
}

@Injectable()
export class GraphqlFetcherService {
  private readonly logger = new Logger(GraphqlFetcherService.name);

  constructor(
    private graphqlClient: GraphqlClientService,
    private configService: ConfigService,
    private priceFetcher: PriceFetcherService,
  ) {}

  /**
   * Fetch Omnipool swaps for a given block range
   */
  async fetchSwaps(
    fromBlock: number,
    toBlock: number,
    limit: number = 1000,
  ): Promise<FetchResult<SwapOrRoutedTradeNode>> {
    this.logger.debug(
      `Fetching swaps from block ${fromBlock} to ${toBlock} (limit: ${limit})`,
    );

    const variables = {
      fromBlock,
      toBlock,
      first: limit,
    };

    try {
      const response = await this.graphqlClient.query<GetSwapsResponse>(
        GET_SWAPS_QUERY,
        variables,
      );

      this.logger.log(
        `Fetched ${response.swaps.nodes.length} swaps (total: ${response.swaps.totalCount})`,
      );

      return {
        items: response.swaps.nodes,
        totalCount: response.swaps.totalCount,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch swaps for blocks ${fromBlock}-${toBlock}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Fetch Omnipool routed trades for a given block range
   * Used for blocks >= OMNIPOOL_RUNTIME_UPGRADE_BLOCK
   * Filters out routed trades with no Omnipool swaps (empty swaps array)
   */
  async fetchRoutedTrades(
    fromBlock: number,
    toBlock: number,
    limit: number = 1000,
  ): Promise<FetchResult<SwapOrRoutedTradeNode>> {
    this.logger.debug(
      `Fetching routed trades from block ${fromBlock} to ${toBlock} (limit: ${limit})`,
    );

    const variables = {
      fromBlock,
      toBlock,
      first: limit,
    };

    try {
      const response =
        await this.graphqlClient.query<GetRoutedTradesResponse>(
          GET_ROUTED_TRADES_QUERY,
          variables,
        );

      // Filter out routed trades with no Omnipool swaps
      // (These can occur when a routed trade has only non-Omnipool swaps)
      const omnipoolRoutedTrades = response.routedTrades.nodes.filter(
        (trade) => trade.swaps.nodes.length > 0,
      );

      const filteredCount = response.routedTrades.nodes.length - omnipoolRoutedTrades.length;
      if (filteredCount > 0) {
        this.logger.debug(
          `Filtered out ${filteredCount} routed trades with no Omnipool swaps`,
        );
      }

      this.logger.log(
        `Fetched ${omnipoolRoutedTrades.length} Omnipool routed trades (total before filter: ${response.routedTrades.totalCount})`,
      );

      return {
        items: omnipoolRoutedTrades as SwapOrRoutedTradeNode[],
        totalCount: response.routedTrades.totalCount,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch routed trades for blocks ${fromBlock}-${toBlock}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Fetch swaps or routed trades based on block height
   * Automatically selects the correct query based on runtime upgrade block
   */
  async fetchSwapsOrRoutedTrades(
    fromBlock: number,
    toBlock: number,
    limit: number = 1000,
  ): Promise<FetchResult<SwapOrRoutedTradeNode>> {
    const upgradeBlock =
      this.configService.get('ingestion.omnipoolRuntimeUpgradeBlock', {
        infer: true,
      }) || 11394694;

    // If the entire range is before the upgrade, use legacy swaps query
    if (toBlock < upgradeBlock) {
      return this.fetchSwaps(fromBlock, toBlock, limit);
    }

    // If the entire range is after the upgrade, use routed trades query
    if (fromBlock >= upgradeBlock) {
      return this.fetchRoutedTrades(fromBlock, toBlock, limit);
    }

    // If the range spans the upgrade block, split into two queries
    this.logger.log(
      `Block range spans runtime upgrade at ${upgradeBlock}, splitting query`,
    );

    const preUpgradeData = await this.fetchSwaps(
      fromBlock,
      upgradeBlock - 1,
      limit,
    );

    const postUpgradeData = await this.fetchRoutedTrades(
      upgradeBlock,
      toBlock,
      limit,
    );

    return {
      items: [...preUpgradeData.items, ...postUpgradeData.items],
      totalCount: preUpgradeData.totalCount + postUpgradeData.totalCount,
    };
  }

  /**
   * Extract unique asset IDs from swaps' fee data
   * Works with both SwapNode and RoutedTradeNode
   */
  extractUniqueAssetIds(swaps: SwapOrRoutedTradeNode[]): string[] {
    const assetIdSet = new Set<string>();

    swaps.forEach((swap) => {
      if (isRoutedTradeNode(swap)) {
        // For routed trades, extract from nested swaps
        swap.swaps.nodes.forEach((nestedSwap) => {
          nestedSwap.swapFees.nodes.forEach((fee) => {
            assetIdSet.add(fee.assetId);
          });
        });
      } else {
        // For regular swaps
        swap.swapFees.nodes.forEach((fee) => {
          assetIdSet.add(fee.assetId);
        });
      }
    });

    return Array.from(assetIdSet);
  }

  /**
   * Fetch prices for a set of assets and build a complete price map with '0' fallback for missing assets.
   */
  async buildBatchPriceMap(
    assetIds: string[],
    blockHeight: number,
  ): Promise<AssetPriceMap> {
    if (assetIds.length === 0) return {};

    try {
      const fetchedPrices = await this.priceFetcher.fetchNearestAssetPrices(assetIds, blockHeight);

      const missingAssetIds = assetIds.filter((id) => !fetchedPrices[id]);
      if (missingAssetIds.length > 0) {
        this.logger.warn(
          `Block ${blockHeight}: ${missingAssetIds.length}/${assetIds.length} assets have no historical prices: ${missingAssetIds.join(', ')}`,
        );
      }

      return Object.fromEntries(assetIds.map((id) => [id, fetchedPrices[id] || '0']));
    } catch (error) {
      this.logger.error(
        `Failed to fetch batch prices for block ${blockHeight}: ${error.message}`,
      );
      return Object.fromEntries(assetIds.map((id) => [id, '0']));
    }
  }

  /**
   * Fetch swaps with pagination support
   * Handles cases where totalCount > limit
   * Block-aware: uses appropriate query based on block height
   */
  async fetchAllSwapsInRange(
    fromBlock: number,
    toBlock: number,
  ): Promise<SwapOrRoutedTradeNode[]> {
    const allSwaps: SwapOrRoutedTradeNode[] = [];
    const batchSize = 1000;

    let hasMore = true;
    let currentFromBlock = fromBlock;

    while (hasMore && currentFromBlock <= toBlock) {
      const { items: swaps, totalCount } = await this.fetchSwapsOrRoutedTrades(
        currentFromBlock,
        toBlock,
        batchSize,
      );

      allSwaps.push(...swaps);

      if (swaps.length < batchSize || totalCount <= allSwaps.length) {
        hasMore = false;
      } else {
        const firstBlock = swaps[0].paraBlockHeight;
        const lastBlock = swaps[swaps.length - 1].paraBlockHeight;

        // If all items share one block, that block has more events than batchSize — warn about potential data loss
        if (firstBlock === lastBlock) {
          this.logger.warn(
            `Block ${lastBlock} contains >${batchSize} events; events beyond the first ${batchSize} will be skipped. ` +
            `Consider reducing batch size or implementing offset pagination.`,
          );
        }

        currentFromBlock = lastBlock + 1;
      }
    }

    this.logger.log(
      `Fetched total of ${allSwaps.length} swaps/trades for blocks ${fromBlock}-${toBlock}`,
    );

    return allSwaps;
  }
}

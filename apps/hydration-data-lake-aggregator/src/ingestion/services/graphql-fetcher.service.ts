import { Injectable, Logger } from '@nestjs/common';

import { GraphqlClientService } from '../../graphql-client/graphql-client.service';
import {
  GET_ASSET_PRICES_AT_BLOCK_QUERY,
  GET_NEAREST_ASSET_PRICES_QUERY,
  GET_SWAPS_QUERY,
  GET_ROUTED_TRADES_QUERY,
} from '../../graphql-client/queries/swaps.queries';
import {
  AssetSpotPriceNode,
  GetAssetPricesAtBlockResponse,
  GetSwapsResponse,
  GetRoutedTradesResponse,
  SwapNode,
  RoutedTradeNode,
} from '../../graphql-client/types/graphql-response.types';
import { ConfigService } from '@nestjs/config';

// Union type to handle both legacy swaps and new routed trades
export type SwapOrRoutedTradeNode = SwapNode | RoutedTradeNode;

// Type guard to check if node is a RoutedTradeNode
export function isRoutedTradeNode(
  node: SwapOrRoutedTradeNode,
): node is RoutedTradeNode {
  return 'inputAssetIds' in node && 'outputAssetIds' in node && 'swaps' in node;
}

export interface FetchedSwapsData {
  swaps: SwapOrRoutedTradeNode[];
  totalCount: number;
}

export interface AssetPriceMap {
  [assetId: string]: string; // assetId -> priceNormalised
}

@Injectable()
export class GraphqlFetcherService {
  private readonly logger = new Logger(GraphqlFetcherService.name);

  constructor(
    private graphqlClient: GraphqlClientService,
    private configService: ConfigService,
  ) {}

  /**
   * Fetch Omnipool swaps for a given block range
   */
  async fetchSwaps(
    fromBlock: number,
    toBlock: number,
    limit: number = 1000,
  ): Promise<FetchedSwapsData> {
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
        swaps: response.swaps.nodes,
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
   * Fetch asset USD prices at a specific block height
   * Returns a map of assetId -> priceNormalised (USD price)
   */
  async fetchAssetPricesAtBlock(
    assetIds: string[],
    blockHeight: number,
  ): Promise<AssetPriceMap> {
    if (assetIds.length === 0) {
      return {};
    }

    this.logger.debug(
      `Fetching prices for ${assetIds.length} assets at block ${blockHeight}`,
    );

    const variables = {
      assetIds,
      blockHeight,
    };

    try {
      const response =
        await this.graphqlClient.query<GetAssetPricesAtBlockResponse>(
          GET_ASSET_PRICES_AT_BLOCK_QUERY,
          variables,
        );

      const priceMap: AssetPriceMap = {};

      response.assetSpotPriceHistoricalData.nodes.forEach((priceNode) => {
        const assetId = priceNode.assetInId;
        const usdPrice = priceNode.priceNormalised;

        priceMap[assetId] = usdPrice;
      });

      this.logger.debug(
        `Fetched prices for ${Object.keys(priceMap).length} assets`,
      );

      return priceMap;
    } catch (error) {
      this.logger.error(
        `Failed to fetch asset prices at block ${blockHeight}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Fetch nearest historical asset prices for a given block height
   * Uses lessThanOrEqualTo filter to get the most recent price at or before the target block
   * This handles sparse price data where prices only update when they change
   */
  async fetchNearestAssetPrices(
    assetIds: string[],
    blockHeight: number,
  ): Promise<AssetPriceMap> {
    if (assetIds.length === 0) {
      return {};
    }

    this.logger.debug(
      `Fetching nearest prices for ${assetIds.length} assets at or before block ${blockHeight}`,
    );

    const variables = {
      assetIds,
      blockHeight,
    };

    try {
      const response =
        await this.graphqlClient.query<GetAssetPricesAtBlockResponse>(
          GET_NEAREST_ASSET_PRICES_QUERY,
          variables,
        );

      const priceMap: AssetPriceMap = {};

      // Group prices by asset ID and take the most recent (highest block number)
      const assetPricesByBlock = new Map<string, AssetSpotPriceNode>();

      response.assetSpotPriceHistoricalData.nodes.forEach((priceNode) => {
        const assetId = priceNode.assetInId;
        const existing = assetPricesByBlock.get(assetId);

        // Keep the price with the highest block number (most recent)
        if (!existing || priceNode.paraBlockHeight > existing.paraBlockHeight) {
          assetPricesByBlock.set(assetId, priceNode);
        }
      });

      // Convert to price map
      assetPricesByBlock.forEach((priceNode, assetId) => {
        priceMap[assetId] = priceNode.priceNormalised;
      });

      const spotPriceBaseAssetId: string = this.configService.get(
        `price.spotPriceBaseAssetId`,
      )!;

      // Price of SPot Price Base asset is always 1:1
      if (
        assetIds.includes(spotPriceBaseAssetId) &&
        !priceMap[spotPriceBaseAssetId]
      ) {
        priceMap[spotPriceBaseAssetId] = '1';
      }

      this.logger.debug(
        `Fetched nearest prices for ${Object.keys(priceMap).length}/${assetIds.length} assets`,
      );

      return priceMap;
    } catch (error) {
      this.logger.error(
        `Failed to fetch nearest asset prices for block ${blockHeight}`,
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
  ): Promise<FetchedSwapsData> {
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
        swaps: omnipoolRoutedTrades as SwapOrRoutedTradeNode[],
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
  ): Promise<FetchedSwapsData> {
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
      swaps: [...preUpgradeData.swaps, ...postUpgradeData.swaps],
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
      const { swaps, totalCount } = await this.fetchSwapsOrRoutedTrades(
        currentFromBlock,
        toBlock,
        batchSize,
      );

      allSwaps.push(...swaps);

      if (swaps.length < batchSize || totalCount <= allSwaps.length) {
        hasMore = false;
      } else {
        // Move to next batch starting from last processed block + 1
        const lastBlock = swaps[swaps.length - 1].paraBlockHeight;
        currentFromBlock = lastBlock + 1;
      }
    }

    this.logger.log(
      `Fetched total of ${allSwaps.length} swaps/trades for blocks ${fromBlock}-${toBlock}`,
    );

    return allSwaps;
  }
}

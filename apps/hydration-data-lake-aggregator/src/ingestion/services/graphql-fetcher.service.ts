import { Injectable, Logger } from '@nestjs/common';
import { GraphqlClientService } from '../../graphql-client/graphql-client.service';
import {
  GET_SWAPS_QUERY,
  GET_ASSET_PRICES_AT_BLOCK_QUERY,
} from '../../graphql-client/queries/swaps.queries';
import {
  GetSwapsResponse,
  GetAssetPricesAtBlockResponse,
  SwapNode,
  AssetSpotPriceNode,
} from '../../graphql-client/types/graphql-response.types';

export interface FetchedSwapsData {
  swaps: SwapNode[];
  totalCount: number;
}

export interface AssetPriceMap {
  [assetId: string]: string; // assetId -> priceNormalised
}

@Injectable()
export class GraphqlFetcherService {
  private readonly logger = new Logger(GraphqlFetcherService.name);

  constructor(private graphqlClient: GraphqlClientService) {}

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
      const response =
        await this.graphqlClient.query<GetSwapsResponse>(
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
        const assetId = priceNode.assetInAssetRegistryId;
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
   * Extract unique asset IDs from swaps' fee data
   */
  extractUniqueAssetIds(swaps: SwapNode[]): string[] {
    const assetIdSet = new Set<string>();

    swaps.forEach((swap) => {
      swap.swapFees.nodes.forEach((fee) => {
        assetIdSet.add(fee.assetId);
      });
    });

    return Array.from(assetIdSet);
  }

  /**
   * Fetch swaps with pagination support
   * Handles cases where totalCount > limit
   */
  async fetchAllSwapsInRange(
    fromBlock: number,
    toBlock: number,
  ): Promise<SwapNode[]> {
    const allSwaps: SwapNode[] = [];
    const batchSize = 1000;

    let hasMore = true;
    let currentFromBlock = fromBlock;

    while (hasMore && currentFromBlock <= toBlock) {
      const { swaps, totalCount } = await this.fetchSwaps(
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
      `Fetched total of ${allSwaps.length} swaps for blocks ${fromBlock}-${toBlock}`,
    );

    return allSwaps;
  }
}

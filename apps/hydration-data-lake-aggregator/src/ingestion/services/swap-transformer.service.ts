import { Injectable, Logger } from '@nestjs/common';
import { SwapNode } from '../../graphql-client/types/graphql-response.types';
import { SwapRaw } from '../../database/entities/swap-raw.entity';
import { FeeCalculatorService, CalculatedFeeData } from './fee-calculator.service';
import { AssetPriceMap, GraphqlFetcherService } from './graphql-fetcher.service';

@Injectable()
export class SwapTransformerService {
  private readonly logger = new Logger(SwapTransformerService.name);

  constructor(
    private feeCalculator: FeeCalculatorService,
    private graphqlFetcher: GraphqlFetcherService,
  ) {}

  /**
   * Transform GraphQL SwapNode to SwapRaw entity
   * Fetches decimals from asset registry and prices from GraphQL
   */
  async transformSwap(
    swap: SwapNode,
    priceMap?: AssetPriceMap,
  ): Promise<SwapRaw> {
    // Calculate fees (no USD conversion) - now async
    const feeData: CalculatedFeeData =
      await this.feeCalculator.calculateSwapFees(swap);

    // Parse timestamp to Date
    const time = new Date(swap.paraTimestamp);

    // Fetch nearest prices if not provided
    let spotPrices: Record<string, string> = {};
    if (priceMap) {
      // Use provided price map (batch-fetched for efficiency)
      for (const assetId of feeData.feeAssetIds) {
        const price = priceMap[assetId];
        if (price !== undefined) {
          spotPrices[assetId] = price;
        }
      }
    } else {
      // Fetch nearest historical prices for this block (handles sparse price data)
      try {
        const fetchedPrices = await this.graphqlFetcher.fetchNearestAssetPrices(
          feeData.feeAssetIds,
          swap.paraBlockHeight,
        );

        // Log missing prices as warnings
        const missingAssetIds = feeData.feeAssetIds.filter(
          (id) => !fetchedPrices[id],
        );
        if (missingAssetIds.length > 0) {
          this.logger.warn(
            `Swap ${swap.id} at block ${swap.paraBlockHeight}: ${missingAssetIds.length}/${feeData.feeAssetIds.length} assets have no historical prices: ${missingAssetIds.join(', ')}`,
          );
        }

        // Include all requested assets, using '0' for missing prices
        for (const assetId of feeData.feeAssetIds) {
          spotPrices[assetId] = fetchedPrices[assetId] || '0';
        }
      } catch (error) {
        this.logger.error(
          `Failed to fetch prices for swap ${swap.id} at block ${swap.paraBlockHeight}: ${error.message}`,
        );
        // Use '0' for all assets on error
        for (const assetId of feeData.feeAssetIds) {
          spotPrices[assetId] = '0';
        }
      }
    }

    // Create entity
    const swapRaw = new SwapRaw();
    swapRaw.swap_id = swap.id;
    swapRaw.time = time;
    swapRaw.block_height = swap.paraBlockHeight;
    swapRaw.filler_id = swap.fillerId;
    swapRaw.filler_type = swap.fillerType;
    swapRaw.fee_asset_ids = feeData.feeAssetIds;
    swapRaw.fee_amounts_raw = feeData.feeAmountsRaw;
    swapRaw.fee_by_recipient = feeData.feeByRecipient;
    swapRaw.fee_spot_prices = spotPrices;

    return swapRaw;
  }

  /**
   * Transform multiple swaps in batch
   * Fetches prices once for all swaps for efficiency
   */
  async transformSwapsBatch(
    swaps: SwapNode[],
    blockHeight?: number,
  ): Promise<SwapRaw[]> {
    this.logger.debug(`Transforming ${swaps.length} swaps`);

    // Fetch prices once for all swaps if block height is provided
    let priceMap: AssetPriceMap | undefined;
    if (blockHeight && swaps.length > 0) {
      // Collect all unique asset IDs
      const allAssetIds = new Set<string>();
      for (const swap of swaps) {
        swap.swapFees.nodes.forEach((fee) => allAssetIds.add(fee.assetId));
      }

      try {
        const fetchedPrices = await this.graphqlFetcher.fetchNearestAssetPrices(
          Array.from(allAssetIds),
          blockHeight,
        );

        // Log missing prices
        const missingAssetIds = Array.from(allAssetIds).filter(
          (id) => !fetchedPrices[id],
        );
        if (missingAssetIds.length > 0) {
          this.logger.warn(
            `Block ${blockHeight}: ${missingAssetIds.length}/${allAssetIds.size} assets have no historical prices: ${missingAssetIds.join(', ')}`,
          );
        }

        // Build complete price map with '0' for missing prices
        priceMap = {};
        for (const assetId of allAssetIds) {
          priceMap[assetId] = fetchedPrices[assetId] || '0';
        }

        this.logger.debug(
          `Fetched ${Object.keys(fetchedPrices).length}/${allAssetIds.size} nearest prices for block ${blockHeight}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to fetch batch prices for block ${blockHeight}: ${error.message}`,
        );
        // Create price map with all '0' on error
        priceMap = {};
        for (const assetId of allAssetIds) {
          priceMap[assetId] = '0';
        }
      }
    }

    const transformedSwaps = await Promise.all(
      swaps.map((swap) => this.transformSwap(swap, priceMap)),
    );

    const validSwaps = transformedSwaps.filter((swap) => {
      // Validate required fields
      if (!swap.swap_id || !swap.time || !swap.block_height) {
        this.logger.warn(
          `Invalid swap data: missing required fields for swap ${swap.swap_id}`,
        );
        return false;
      }
      return true;
    });

    this.logger.log(
      `Transformed ${validSwaps.length}/${swaps.length} swaps successfully`,
    );

    return validSwaps;
  }

  /**
   * Validate a transformed swap
   */
  private validateSwap(swap: SwapRaw): boolean {
    if (!swap.swap_id) {
      this.logger.warn('Swap missing ID');
      return false;
    }

    if (!swap.time) {
      this.logger.warn(`Swap ${swap.swap_id} missing timestamp`);
      return false;
    }

    if (!swap.block_height || swap.block_height <= 0) {
      this.logger.warn(`Swap ${swap.swap_id} has invalid block height`);
      return false;
    }

    if (!swap.fee_asset_ids || swap.fee_asset_ids.length === 0) {
      this.logger.warn(`Swap ${swap.swap_id} has no fee assets`);
      return false;
    }

    return true;
  }

  /**
   * Get statistics about transformed data
   */
  getTransformationStatistics(swaps: SwapRaw[]): {
    totalSwaps: number;
    uniqueFeeAssets: number;
  } {
    const uniqueAssets = new Set<string>();
    swaps.forEach((swap) => {
      swap.fee_asset_ids.forEach((assetId) => uniqueAssets.add(assetId));
    });

    return {
      totalSwaps: swaps.length,
      uniqueFeeAssets: uniqueAssets.size,
    };
  }
}

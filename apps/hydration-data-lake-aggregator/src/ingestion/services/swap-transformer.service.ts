import { Injectable, Logger } from '@nestjs/common';
import { SwapNode } from '../../graphql-client/types/graphql-response.types';
import { SwapRaw } from '../../database/entities/swap-raw.entity';
import { FeeCalculatorService, CalculatedFeeData } from './fee-calculator.service';
import { AssetPriceMap } from './graphql-fetcher.service';

@Injectable()
export class SwapTransformerService {
  private readonly logger = new Logger(SwapTransformerService.name);

  constructor(private feeCalculator: FeeCalculatorService) {}

  /**
   * Transform GraphQL SwapNode to SwapRaw entity
   */
  transformSwap(swap: SwapNode): SwapRaw {
    // Calculate fees (no USD conversion)
    const feeData: CalculatedFeeData = this.feeCalculator.calculateSwapFees(swap);

    // Parse timestamp to Date
    const time = new Date(swap.paraTimestamp);

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
    swapRaw.fee_spot_prices = null; // Initialize as null (to be enriched later)

    return swapRaw;
  }

  /**
   * Transform multiple swaps in batch
   */
  transformSwapsBatch(swaps: SwapNode[]): SwapRaw[] {
    this.logger.debug(`Transforming ${swaps.length} swaps`);

    const transformedSwaps = swaps.map((swap) => this.transformSwap(swap));

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

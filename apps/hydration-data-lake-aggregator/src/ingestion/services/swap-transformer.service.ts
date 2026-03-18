import { Injectable, Logger } from '@nestjs/common';
import { NestedSwapNode, RoutedTradeNode } from '../../graphql-client/types/graphql-response.types';
import { SwapRaw } from '../../database/entities/swap-raw.entity';
import { FeeCalculatorService, CalculatedFeeData } from './fee-calculator.service';
import { SwapOrRoutedTradeNode, isRoutedTradeNode } from './graphql-fetcher.service';
import { AssetPriceMap, PriceFetcherService } from '../../common/services/price-fetcher.service';
import { AssetRegistryService } from '../../common/services/asset-registry.service';

@Injectable()
export class SwapTransformerService {
  private readonly logger = new Logger(SwapTransformerService.name);

  constructor(
    private feeCalculator: FeeCalculatorService,
    private priceFetcher: PriceFetcherService,
    private assetRegistry: AssetRegistryService,
  ) {}

  /**
   * Transform GraphQL SwapNode or RoutedTradeNode to SwapRaw entity
   * Fetches decimals from asset registry and prices from GraphQL
   * Works with both pre-upgrade swaps and post-upgrade routed trades
   */
  async transformSwap(
    swap: SwapOrRoutedTradeNode,
    priceMap?: AssetPriceMap,
    decimalsMap?: Map<string, number>,
  ): Promise<SwapRaw> {
    // Calculate fees (no USD conversion) - now async
    const feeData: CalculatedFeeData =
      await this.feeCalculator.calculateSwapFees(swap, decimalsMap);

    // Extract timestamp, fillerId, fillerType (handle both node types)
    let paraTimestamp: string;
    let fillerId: string;
    let fillerType: string;

    if (isRoutedTradeNode(swap)) {
      // For routed trades, get from first nested swap (all swaps in a routed trade share these values)
      const firstSwap = swap.swaps.nodes[0];
      if (!firstSwap) {
        throw new Error(`RoutedTrade ${swap.id} has no swaps`);
      }
      paraTimestamp = firstSwap.paraTimestamp;
      fillerId = firstSwap.fillerId;
      fillerType = firstSwap.fillerType;
    } else {
      // For regular swaps, get directly
      paraTimestamp = swap.paraTimestamp;
      fillerId = swap.fillerId;
      fillerType = swap.fillerType;
    }

    // Parse timestamp to Date
    const time = new Date(paraTimestamp);

    // Use batch-fetched price map; prices missing from the map default to '0'
    const spotPrices: Record<string, string> = {};
    if (priceMap) {
      for (const assetId of feeData.feeAssetIds) {
        spotPrices[assetId] = priceMap[assetId] ?? '0';
      }
    }

    // Create entity
    const swapRaw = new SwapRaw();
    swapRaw.swap_id = swap.id;
    swapRaw.time = time;
    swapRaw.block_height = swap.paraBlockHeight;
    swapRaw.filler_id = fillerId;
    swapRaw.filler_type = fillerType;
    swapRaw.fee_asset_ids = feeData.feeAssetIds;
    swapRaw.fee_amounts_raw = feeData.feeAmountsRaw;
    swapRaw.fee_by_recipient = feeData.feeByRecipient;
    swapRaw.fee_spot_prices = spotPrices;

    return swapRaw;
  }

  /**
   * Transform multiple swaps in batch
   * Fetches prices once for all swaps for efficiency
   * Works with both SwapNode and RoutedTradeNode
   */
  async transformSwapsBatch(
    swaps: SwapOrRoutedTradeNode[],
    blockHeight?: number,
  ): Promise<SwapRaw[]> {
    this.logger.debug(`Transforming ${swaps.length} swaps/trades`);

    // Collect all unique asset IDs upfront (handle both swap types)
    const allAssetIds = new Set<string>();
    for (const swap of swaps) {
      if (isRoutedTradeNode(swap)) {
        swap.swaps.nodes.forEach((nestedSwap) => {
          nestedSwap.swapFees.nodes.forEach((fee) => allAssetIds.add(fee.assetId));
          // Also add input assets for H2O special case
          nestedSwap.swapInputs.nodes.forEach((input) => allAssetIds.add(input.assetId));
        });
      } else {
        swap.swapFees.nodes.forEach((fee) => allAssetIds.add(fee.assetId));
      }
    }

    // Pre-fetch prices + decimals once for the entire batch
    let priceMap: AssetPriceMap | undefined;
    if (blockHeight && swaps.length > 0) {
      priceMap = await this.priceFetcher.buildBatchPriceMap(
        Array.from(allAssetIds),
        blockHeight,
      );
    }

    // Avoids N redundant in-memory lookups by pre-fetching once; hop processing hits the warmed cache
    const decimalsMap = await this.assetRegistry.getDecimalsBatch(Array.from(allAssetIds));

    const transformedSwaps = await Promise.all(
      swaps.flatMap((swap) =>
        isRoutedTradeNode(swap)
          ? swap.swaps.nodes.map((hop) => this.transformSwapHop(swap, hop, priceMap))
          : [this.transformSwap(swap, priceMap, decimalsMap)],
      ),
    );

    const validSwaps = transformedSwaps.filter((swap) => this.validateSwap(swap));

    this.logger.log(
      `Transformed ${validSwaps.length}/${swaps.length} swaps/trades successfully`,
    );

    return validSwaps;
  }

  /**
   * Transform a single routed trade hop into a SwapRaw row
   * Uses hop.id as swap_id and only processes that hop's fees
   */
  async transformSwapHop(
    routedTrade: RoutedTradeNode,
    hop: NestedSwapNode,
    priceMap?: AssetPriceMap,
  ): Promise<SwapRaw> {
    const feeData = await this.feeCalculator.calculateHopFees(
      hop,
      routedTrade.paraBlockHeight,
      routedTrade.inputAssetIds,
    );

    const time = new Date(hop.paraTimestamp);

    const spotPrices: Record<string, string> = {};
    if (priceMap) {
      for (const assetId of feeData.feeAssetIds) {
        spotPrices[assetId] = priceMap[assetId] ?? '0';
      }
    }

    const swapRaw = new SwapRaw();
    swapRaw.swap_id = hop.id;
    swapRaw.time = time;
    swapRaw.block_height = routedTrade.paraBlockHeight;
    swapRaw.filler_id = hop.fillerId;
    swapRaw.filler_type = hop.fillerType;
    swapRaw.fee_asset_ids = feeData.feeAssetIds;
    swapRaw.fee_amounts_raw = feeData.feeAmountsRaw;
    swapRaw.fee_by_recipient = feeData.feeByRecipient;
    swapRaw.fee_spot_prices = spotPrices;

    return swapRaw;
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

import { Injectable, Logger } from '@nestjs/common';
import { MoneyMarketRaw } from '../../database/entities/money-market-raw.entity';
import { LiquidationFees } from './liquidation-fee-calculator.service';
import {
  AssetPriceMap,
  GraphqlFetcherService,
} from '../../ingestion/services/graphql-fetcher.service';

/**
 * Service responsible for transforming liquidation fees into database entities
 * Maps calculated fee data to MoneyMarketRaw entity format
 */
@Injectable()
export class LiquidationTransformerService {
  private readonly logger = new Logger(LiquidationTransformerService.name);

  constructor(private graphqlFetcher: GraphqlFetcherService) {}

  /**
   * Transform liquidation fees to MoneyMarketRaw entity
   * Fetches prices if priceMap is provided, otherwise leaves empty
   *
   * @param fees - Calculated liquidation fees
   * @param priceMap - Optional price map for this block
   * @returns MoneyMarketRaw entity ready for database insertion
   */
  async transformLiquidation(
    fees: LiquidationFees,
    priceMap?: AssetPriceMap,
  ): Promise<MoneyMarketRaw> {
    // Parse timestamp to Date
    const time = new Date(fees.timestamp);

    // Fetch nearest prices if not provided
    let spotPrices: Record<string, string> = {};
    if (priceMap) {
      // Use provided price map (batch-fetched for efficiency)
      for (const assetId of fees.feeAssetIds) {
        const price = priceMap[assetId];
        if (price !== undefined) {
          spotPrices[assetId] = price;
        }
      }
    } else {
      // Fetch nearest historical prices for this block (handles sparse price data)
      try {
        const fetchedPrices = await this.graphqlFetcher.fetchNearestAssetPrices(
          fees.feeAssetIds,
          fees.blockHeight,
        );

        // Log missing prices as warnings
        const missingAssetIds = fees.feeAssetIds.filter(
          (id) => !fetchedPrices[id],
        );
        if (missingAssetIds.length > 0) {
          this.logger.warn(
            `Liquidation ${fees.liquidationEventId} at block ${fees.blockHeight}: ${missingAssetIds.length}/${fees.feeAssetIds.length} assets have no historical prices: ${missingAssetIds.join(', ')}`,
          );
        }

        // Include all requested assets, using '0' for missing prices
        for (const assetId of fees.feeAssetIds) {
          spotPrices[assetId] = fetchedPrices[assetId] || '0';
        }
      } catch (error) {
        this.logger.error(
          `Failed to fetch prices for liquidation ${fees.liquidationEventId} at block ${fees.blockHeight}: ${error.message}`,
        );
        // Use '0' for all assets on error
        for (const assetId of fees.feeAssetIds) {
          spotPrices[assetId] = '0';
        }
      }
    }

    // Create entity
    const moneyMarketRaw = new MoneyMarketRaw();
    moneyMarketRaw.liquidation_event_id = fees.liquidationEventId;
    moneyMarketRaw.time = time;
    moneyMarketRaw.block_height = fees.blockHeight;
    moneyMarketRaw.liquidation_call_id = fees.liquidationCallId;
    moneyMarketRaw.fee_asset_ids = fees.feeAssetIds;
    moneyMarketRaw.fee_amounts_raw = fees.feeAmountsRaw;
    moneyMarketRaw.fee_by_transfer = fees.treasuryTransfers;
    moneyMarketRaw.fee_spot_prices = spotPrices;

    return moneyMarketRaw;
  }

  /**
   * Transform multiple liquidations in batch
   * Fetches prices once for all liquidations for efficiency
   *
   * @param liquidationFees - Array of calculated liquidation fees
   * @param blockHeight - Optional block height for batch price fetching
   * @returns Array of MoneyMarketRaw entities
   */
  async transformLiquidationsBatch(
    liquidationFees: LiquidationFees[],
    blockHeight?: number,
  ): Promise<MoneyMarketRaw[]> {
    this.logger.debug(`Transforming ${liquidationFees.length} liquidations`);

    // Fetch prices once for all liquidations if block height is provided
    let priceMap: AssetPriceMap | undefined;
    if (blockHeight && liquidationFees.length > 0) {
      // Collect all unique asset IDs
      const allAssetIds = new Set<string>();
      for (const fees of liquidationFees) {
        fees.feeAssetIds.forEach((id) => allAssetIds.add(id));
      }

      priceMap = await this.graphqlFetcher.buildBatchPriceMap(
        Array.from(allAssetIds),
        blockHeight,
      );
    }

    const transformedLiquidations = await Promise.all(
      liquidationFees.map((fees) => this.transformLiquidation(fees, priceMap)),
    );

    const validLiquidations = transformedLiquidations.filter((liquidation) => this.validateLiquidation(liquidation));

    this.logger.log(
      `Transformed ${validLiquidations.length}/${liquidationFees.length} liquidations successfully`,
    );

    return validLiquidations;
  }

  /**
   * Validate a transformed liquidation
   *
   * @param liquidation - MoneyMarketRaw entity to validate
   * @returns true if valid, false otherwise
   */
  private validateLiquidation(liquidation: MoneyMarketRaw): boolean {
    if (!liquidation.liquidation_event_id) {
      this.logger.warn('Liquidation missing event ID');
      return false;
    }

    if (!liquidation.time) {
      this.logger.warn(
        `Liquidation ${liquidation.liquidation_event_id} missing timestamp`,
      );
      return false;
    }

    if (!liquidation.block_height || liquidation.block_height <= 0) {
      this.logger.warn(
        `Liquidation ${liquidation.liquidation_event_id} has invalid block height`,
      );
      return false;
    }

    if (!liquidation.fee_asset_ids || liquidation.fee_asset_ids.length === 0) {
      this.logger.warn(
        `Liquidation ${liquidation.liquidation_event_id} has no fee assets`,
      );
      return false;
    }

    if (
      !liquidation.fee_by_transfer ||
      liquidation.fee_by_transfer.length === 0
    ) {
      this.logger.warn(
        `Liquidation ${liquidation.liquidation_event_id} has no treasury transfers`,
      );
      return false;
    }

    return true;
  }

  /**
   * Get statistics about transformed data
   *
   * @param liquidations - Array of MoneyMarketRaw entities
   * @returns Transformation statistics
   */
  getTransformationStatistics(liquidations: MoneyMarketRaw[]): {
    totalLiquidations: number;
    uniqueFeeAssets: number;
    totalTransfers: number;
  } {
    const uniqueAssets = new Set<string>();
    let totalTransfers = 0;

    liquidations.forEach((liquidation) => {
      liquidation.fee_asset_ids.forEach((assetId) => uniqueAssets.add(assetId));
      totalTransfers += liquidation.fee_by_transfer.length;
    });

    return {
      totalLiquidations: liquidations.length,
      uniqueFeeAssets: uniqueAssets.size,
      totalTransfers,
    };
  }
}

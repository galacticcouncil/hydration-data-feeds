import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SwapRaw } from '../../database/entities/swap-raw.entity';
import {
  GraphqlFetcherService,
  AssetPriceMap,
} from '../../ingestion/services/graphql-fetcher.service';
import { StateManagerService } from '../../common/services/state-manager.service';
import { AppConfig } from '../../config/app.config';

export interface EnrichmentStats {
  processed: number;
  enriched: number;
  failed: number;
  totalSwaps: number;
  enrichedSwaps: number;
  pendingSwaps: number;
}

@Injectable()
export class PriceEnrichmentService {
  private readonly logger = new Logger(PriceEnrichmentService.name);
  private readonly SERVICE_NAME = 'price-enrichment';
  private readonly BATCH_SIZE: number;
  private readonly MAX_RETRIES: number;

  constructor(
    @InjectRepository(SwapRaw)
    private swapRepository: Repository<SwapRaw>,
    private graphqlFetcher: GraphqlFetcherService,
    private stateManager: StateManagerService,
    private configService: ConfigService<AppConfig>,
  ) {
    this.BATCH_SIZE =
      this.configService.get('enrichment.batchSize', { infer: true }) || 100;
    this.MAX_RETRIES =
      this.configService.get('enrichment.maxRetries', { infer: true }) || 3;
  }

  /**
   * Enriches all unenriched swaps in continuous batches
   * Runs until no more unenriched swaps remain
   * Returns statistics about the enrichment process
   *
   * Note: Enrichment processes swaps based on database state (WHERE fee_spot_prices IS NULL),
   * not sequential block processing. Redis state tracks status and timestamps for monitoring only.
   */
  async enrichNextBatch(): Promise<EnrichmentStats> {
    let totalProcessed = 0;
    let totalEnriched = 0;
    let totalFailed = 0;
    let batchCount = 0;

    // Update Redis state to indicate enrichment is running (for monitoring/observability)
    await this.stateManager.setState(this.SERVICE_NAME, {
      lastProcessedTimestamp: new Date().toISOString(),
      lastIngestionAt: new Date().toISOString(),
      status: 'running',
    });

    // Continue processing until no more unenriched swaps
    while (true) {
      // Fetch next batch of unenriched swaps
      const swaps = await this.fetchUnenrichedSwaps(this.BATCH_SIZE);

      if (swaps.length === 0) {
        this.logger.log(
          batchCount === 0
            ? 'No unenriched swaps found'
            : `Enrichment complete: ${batchCount} batches, ${totalProcessed} swaps processed (${totalEnriched} enriched, ${totalFailed} failed)`,
        );
        break;
      }

      batchCount++;

      // Group swaps by block height to minimize GraphQL calls
      const swapsByBlock = this.groupSwapsByBlock(swaps);
      let enriched = 0;
      let failed = 0;

      this.logger.log(
        `Processing batch ${batchCount}: ${swaps.length} swaps across ${swapsByBlock.size} blocks`,
      );

      // Enrich swaps block by block
      for (const [blockHeight, blockSwaps] of swapsByBlock) {
        try {
          await this.enrichSwapsForBlock(blockHeight, blockSwaps);
          enriched += blockSwaps.length;
        } catch (error) {
          this.logger.error(
            `Failed to enrich block ${blockHeight}`,
            error.stack,
          );
          failed += blockSwaps.length;
          // Mark swaps as failed (with empty object) to prevent infinite retry
          await this.markSwapsAsFailed(blockSwaps);
        }
      }

      totalProcessed += swaps.length;
      totalEnriched += enriched;
      totalFailed += failed;

      this.logger.debug(
        `Batch ${batchCount} complete: ${enriched} enriched, ${failed} failed`,
      );
    }

    return {
      processed: totalProcessed,
      enriched: totalEnriched,
      failed: totalFailed,
      totalSwaps: 0,
      enrichedSwaps: 0,
      pendingSwaps: 0,
    };
  }

  /**
   * Fetches swaps that don't have spot prices yet
   */
  private async fetchUnenrichedSwaps(limit: number): Promise<SwapRaw[]> {
    return await this.swapRepository.find({
      where: { fee_spot_prices: IsNull() },
      order: { time: 'ASC' },
      take: limit,
    });
  }

  /**
   * Groups swaps by block height to minimize GraphQL API calls
   * Example: 100 swaps might span only 10 blocks = 10 price queries instead of 100
   */
  private groupSwapsByBlock(swaps: SwapRaw[]): Map<number, SwapRaw[]> {
    const grouped = new Map<number, SwapRaw[]>();

    for (const swap of swaps) {
      const existing = grouped.get(swap.block_height) || [];
      existing.push(swap);
      grouped.set(swap.block_height, existing);
    }

    return grouped;
  }

  /**
   * Enriches all swaps for a specific block with spot prices
   */
  private async enrichSwapsForBlock(
    blockHeight: number,
    swaps: SwapRaw[],
  ): Promise<void> {
    // Extract unique asset IDs from all swaps in this block
    const assetIds = this.extractAssetIds(swaps);

    // Fetch prices for all assets at this block height (single GraphQL call)
    const priceMap = await this.graphqlFetcher.fetchAssetPricesAtBlock(
      assetIds,
      blockHeight,
    );

    // Build spot prices object for each swap
    for (const swap of swaps) {
      const spotPrices = this.buildSpotPricesObject(
        swap.fee_amounts_raw,
        priceMap,
      );
      swap.fee_spot_prices = spotPrices;
    }

    // Save all swaps for this block
    await this.swapRepository.save(swaps);

    this.logger.debug(
      `Enriched ${swaps.length} swaps at block ${blockHeight} with ${Object.keys(priceMap).length} asset prices`,
    );
  }

  /**
   * Extracts all unique asset IDs from a batch of swaps
   */
  private extractAssetIds(swaps: SwapRaw[]): string[] {
    const assetIdSet = new Set<string>();

    for (const swap of swaps) {
      for (const assetId of Object.keys(swap.fee_amounts_raw)) {
        assetIdSet.add(assetId);
      }
    }

    return Array.from(assetIdSet);
  }

  /**
   * Builds the spot prices object by matching fee_amounts_raw keys to price map
   * Uses "0" for assets without prices (with warning)
   */
  private buildSpotPricesObject(
    feeAmountsRaw: Record<string, string>,
    priceMap: AssetPriceMap,
  ): Record<string, string> {
    const spotPrices: Record<string, string> = {};

    for (const assetId of Object.keys(feeAmountsRaw)) {
      if (priceMap[assetId]) {
        spotPrices[assetId] = priceMap[assetId];
      } else {
        this.logger.warn(`No price found for asset ${assetId}, using 0`);
        spotPrices[assetId] = '0';
      }
    }

    return spotPrices;
  }

  /**
   * Marks swaps as failed by setting fee_spot_prices to empty object
   * This distinguishes from null (not yet processed) and prevents infinite retry
   */
  private async markSwapsAsFailed(swaps: SwapRaw[]): Promise<void> {
    for (const swap of swaps) {
      swap.fee_spot_prices = {};
    }
    await this.swapRepository.save(swaps);
  }

  /**
   * Gets enrichment statistics for monitoring
   */
  async getEnrichmentStats(): Promise<EnrichmentStats> {
    const total = await this.swapRepository.count();
    const enriched = await this.swapRepository
      .createQueryBuilder('swap')
      .where('swap.fee_spot_prices IS NOT NULL')
      .andWhere("swap.fee_spot_prices != '{}'::jsonb")
      .getCount();

    const pending = await this.swapRepository.count({
      where: { fee_spot_prices: IsNull() },
    });

    return {
      processed: 0,
      enriched: 0,
      failed: 0,
      totalSwaps: total,
      enrichedSwaps: enriched,
      pendingSwaps: pending,
    };
  }
}

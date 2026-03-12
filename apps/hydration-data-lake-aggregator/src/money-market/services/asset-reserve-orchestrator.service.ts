import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import { StateManagerService } from '../../common/services/state-manager.service';
import { AppConfig } from '../../config/app.config';
import { MoneyMarketRaw } from '../../database/entities/money-market-raw.entity';
import { AssetReserveFetcherService } from './asset-reserve-fetcher.service';
import { AssetReserveCalculatorService } from './asset-reserve-calculator.service';
import { AssetReserveTransformerService } from './asset-reserve-transformer.service';
import { GraphqlClientService } from '../../graphql-client/services/graphql-client.service';
import { getMaxBlockHeight } from '../../common/utils/block-height.utils';
import { saveInChunks } from '../../common/utils/repository.utils';
import { BaseOrchestratorService } from '../../common/services/base-orchestrator.service';

/**
 * Orchestrator for Asset Reserve fee ingestion
 * Implements continuous batch processing strategy (matches PEPL pattern):
 * 1. Fetch Asset Reserve events (ordered by block height)
 * 2. Calculate normalized amounts (uses AssetRegistryService internally)
 * 3. Transform and save to database (fetches prices internally)
 * 4. Update state with highest block processed
 * 5. Loop until caught up or no more events
 *
 * Uses separate state tracking from regular liquidation penalties and PEPL
 */
@Injectable()
export class AssetReserveOrchestratorService extends BaseOrchestratorService {
  protected readonly SERVICE_NAME = 'asset-reserve';
  private readonly batchSize: number;

  constructor(
    private configService: ConfigService<AppConfig>,
    private fetcher: AssetReserveFetcherService,
    private calculator: AssetReserveCalculatorService,
    private transformer: AssetReserveTransformerService,
    private graphqlClient: GraphqlClientService,
    stateManager: StateManagerService,
    @InjectRepository(MoneyMarketRaw)
    private moneyMarketRepository: Repository<MoneyMarketRaw>,
  ) {
    super(stateManager);
    this.batchSize =
      this.configService.get('assetReserve.batchSize', { infer: true }) || 500;
  }

  protected getStartBlock(): number {
    return this.configService.get('assetReserve.startBlock', { infer: true }) || 1_000_000;
  }

  async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.logger.log(
      `Asset Reserve Orchestrator initialized with start block: ${this.getStartBlock()}, batch size: ${this.batchSize}`,
    );
  }

  /**
   * Main ingestion method - processes Asset Reserve events from last processed block
   * Uses continuous batch processing (loops until caught up)
   */
  async ingest(): Promise<void> {
    if (this.isIngesting) {
      this.logger.warn('Asset Reserve ingestion already in progress, skipping');
      return;
    }

    this.isIngesting = true;

    try {
      // Get last processed block
      const lastProcessedBlock = await this.getLastProcessedBlock();
      const currentBlock = await this.graphqlClient.getCurrentBlockHeight();

      this.logger.log(
        `Starting Asset Reserve ingestion: last=${lastProcessedBlock}, current=${currentBlock}`,
      );

      if (lastProcessedBlock >= currentBlock) {
        this.logger.debug('No new blocks to process for Asset Reserve');
        return;
      }

      // Process in batches (batch of events, not blocks!)
      let hasMore = true;
      let currentFromBlock = lastProcessedBlock;

      while (hasMore) {
        const result = await this.processBatch(currentFromBlock, this.batchSize);

        if (!result.hasMore) {
          hasMore = false;
        } else {
          currentFromBlock = result.highestBlock;
        }

        // Safety check: don't process beyond current block
        if (currentFromBlock >= currentBlock) {
          hasMore = false;
        }
      }

      this.logger.log('Asset Reserve ingestion completed successfully');
    } catch (error) {
      this.logger.error('Asset Reserve ingestion failed', error.stack);
      await this.stateManager.setError(this.SERVICE_NAME, error.message);
      throw error;
    } finally {
      this.isIngesting = false;
    }
  }

  /**
   * Process a batch of Asset Reserve events
   * Returns the highest block processed and whether there are more events
   */
  private async processBatch(
    fromBlock: number,
    batchSize: number,
  ): Promise<{ hasMore: boolean; highestBlock: number }> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Processing Asset Reserve batch: fromBlock=${fromBlock}, batchSize=${batchSize}`,
      );

      // Step 1: Fetch events using pagination
      const { events } =
        await this.fetcher.fetchAssetReserveEvents(fromBlock, batchSize);

      if (events.length === 0) {
        this.logger.debug(`No Asset Reserve events found after block ${fromBlock}`);
        return { hasMore: false, highestBlock: fromBlock };
      }

      this.logger.log(
        `Fetched ${events.length} Asset Reserve events`,
      );

      // Step 2: Calculate normalized amounts
      const normalizedAmounts =
        await this.calculator.calculateBatchAmounts(events);

      this.logger.log(
        `Calculated amounts for ${normalizedAmounts.size}/${events.length} Asset Reserve events`,
      );

      // Step 3: Transform to entities with batch price fetching
      const highestBlockInBatch = getMaxBlockHeight(events, fromBlock);

      const transformedEvents = await this.transformer.transformToEntities(
        events,
        normalizedAmounts,
        highestBlockInBatch,
      );

      // Step 4: Save to database
      if (transformedEvents.length > 0) {
        await this.saveAssetReserveEventsBatch(transformedEvents);
      }

      // Step 5: Update state - use highest block from events batch
      await this.stateManager.updateLastBlock(
        this.SERVICE_NAME,
        highestBlockInBatch,
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `Batch completed in ${duration}ms: ${transformedEvents.length} Asset Reserve events saved, highest block: ${highestBlockInBatch}`,
      );

      // Determine if there are more events to process
      const hasMore = events.length === batchSize;

      return { hasMore, highestBlock: highestBlockInBatch };
    } catch (error) {
      this.logger.error(
        `Batch processing failed for fromBlock ${fromBlock}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Save Asset Reserve events to database in batch
   */
  private async saveAssetReserveEventsBatch(events: MoneyMarketRaw[]): Promise<void> {
    await saveInChunks(this.moneyMarketRepository, events);
    this.logger.debug(`Saved ${events.length} Asset Reserve events to database`);
  }

  /**
   * Get ingestion statistics
   */
  async getIngestionStats(): Promise<{
    lastProcessedBlock: number;
    lastIngestionAt: Date;
    status: string;
    totalAssetReserveEvents: number;
  }> {
    const state = await this.stateManager.getState(this.SERVICE_NAME);

    // Count only Asset Reserve events (filter by feeType)
    const totalAssetReserveEvents = await this.moneyMarketRepository
      .createQueryBuilder('mm')
      .where("mm.fee_by_transfer::jsonb @> '[{\"feeType\": \"ASSET_RESERVE\"}]'")
      .getCount();

    return {
      lastProcessedBlock: state?.lastProcessedBlock || 0,
      lastIngestionAt: state?.lastIngestionAt
        ? new Date(state.lastIngestionAt)
        : new Date(),
      status: state?.status || 'unknown',
      totalAssetReserveEvents,
    };
  }

  /**
   * Legacy method name for backwards compatibility
   * @deprecated Use ingest() instead
   */
  async ingestAssetReserveFees(): Promise<void> {
    return this.ingest();
  }
}

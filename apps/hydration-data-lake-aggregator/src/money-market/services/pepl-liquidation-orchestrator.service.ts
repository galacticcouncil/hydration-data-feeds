import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import { StateManagerService } from '../../common/services/state-manager.service';
import { AppConfig } from '../../config/app.config';
import { MoneyMarketRaw } from '../../database/entities/money-market-raw.entity';
import { PeplLiquidationFetcherService } from './pepl-liquidation-fetcher.service';
import { PeplProfitCalculatorService } from './pepl-profit-calculator.service';
import { PeplProfitTransformerService } from './pepl-profit-transformer.service';
import { GraphqlClientService } from '../../graphql-client/services/graphql-client.service';
import { getMaxBlockHeight } from '../../common/utils/block-height.utils';
import { saveInChunks } from '../../common/utils/repository.utils';
import { BaseOrchestratorService } from '../../common/services/base-orchestrator.service';

/**
 * Orchestrator for PEPL liquidation profit ingestion
 * Implements continuous batch processing strategy (matches liquidation penalty pattern):
 * 1. Fetch PEPL liquidation events (ordered by block height)
 * 2. Calculate normalized profits (uses AssetRegistryService internally)
 * 3. Transform and save to database (fetches prices internally)
 * 4. Update state with highest block processed
 * 5. Loop until caught up or no more events
 *
 * Uses separate state tracking from regular liquidation penalties
 */
@Injectable()
export class PeplLiquidationOrchestratorService extends BaseOrchestratorService {
  protected readonly SERVICE_NAME = 'pepl-liquidation-profit';
  private readonly batchSize: number;

  constructor(
    private configService: ConfigService<AppConfig>,
    private fetcher: PeplLiquidationFetcherService,
    private calculator: PeplProfitCalculatorService,
    private transformer: PeplProfitTransformerService,
    private graphqlClient: GraphqlClientService,
    stateManager: StateManagerService,
    @InjectRepository(MoneyMarketRaw)
    private moneyMarketRepository: Repository<MoneyMarketRaw>,
  ) {
    super(stateManager);
    this.batchSize =
      this.configService.get('peplLiquidation.batchSize', { infer: true }) ||
      500;
  }

  protected getStartBlock(): number {
    return this.configService.get('peplLiquidation.startBlock', { infer: true }) || 1_000_000;
  }

  async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.logger.log(
      `PEPL Liquidation Orchestrator initialized with start block: ${this.getStartBlock()}, batch size: ${this.batchSize}`,
    );
  }

  /**
   * Main ingestion method - processes PEPL events from last processed block
   * Uses continuous batch processing (loops until caught up)
   */
  async ingest(): Promise<void> {
    if (this.isIngesting) {
      this.logger.warn('PEPL ingestion already in progress, skipping');
      return;
    }

    this.isIngesting = true;

    try {
      // Get last processed block
      const lastProcessedBlock = await this.getLastProcessedBlock();
      const currentBlock = await this.graphqlClient.getCurrentBlockHeight();

      this.logger.log(
        `Starting PEPL ingestion: last=${lastProcessedBlock}, current=${currentBlock}`,
      );

      if (lastProcessedBlock >= currentBlock) {
        this.logger.debug('No new blocks to process for PEPL');
        return;
      }

      // Process in batches (batch of events, not blocks!)
      let hasMore = true;
      let currentFromBlock = lastProcessedBlock;

      while (hasMore) {
        const result = await this.processBatch(currentFromBlock, currentBlock, this.batchSize);

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

      this.logger.log('PEPL ingestion completed successfully');
    } catch (error) {
      this.logger.error('PEPL ingestion failed', error.stack);
      await this.stateManager.setError(this.SERVICE_NAME, error.message);
      throw error;
    } finally {
      this.isIngesting = false;
    }
  }

  /**
   * Process a batch of PEPL events
   * Returns the highest block processed and whether there are more events
   */
  private async processBatch(
    fromBlock: number,
    currentBlock: number,
    batchSize: number,
  ): Promise<{ hasMore: boolean; highestBlock: number }> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Processing PEPL batch: fromBlock=${fromBlock}, batchSize=${batchSize}`,
      );

      // Step 1: Fetch events using pagination
      const { items: events, totalCount } =
        await this.fetcher.fetchPeplLiquidationEvents(fromBlock, currentBlock, batchSize);

      if (events.length === 0) {
        this.logger.debug(`No PEPL events found after block ${fromBlock}`);
        return { hasMore: false, highestBlock: fromBlock };
      }

      this.logger.log(
        `Fetched ${events.length} PEPL events (total: ${totalCount})`,
      );

      // Step 2: Calculate normalized profits
      const normalizedProfits =
        await this.calculator.calculateBatchProfits(events);

      this.logger.log(
        `Calculated profits for ${normalizedProfits.size}/${events.length} PEPL events`,
      );

      // Step 3: Transform to entities with batch price fetching
      const highestBlockInBatch = getMaxBlockHeight(events, fromBlock);

      const transformedEvents = await this.transformer.transformToEntities(
        events,
        normalizedProfits,
        highestBlockInBatch,
      );

      // Step 4: Save to database
      if (transformedEvents.length > 0) {
        await this.savePeplEventsBatch(transformedEvents);
      }

      // Step 5: Update state - use highest block from events batch
      await this.stateManager.updateLastBlock(
        this.SERVICE_NAME,
        highestBlockInBatch,
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `Batch completed in ${duration}ms: ${transformedEvents.length} PEPL events saved, highest block: ${highestBlockInBatch}`,
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
   * Save PEPL events to database in batch
   */
  private async savePeplEventsBatch(events: MoneyMarketRaw[]): Promise<void> {
    await saveInChunks(this.moneyMarketRepository, events);
    this.logger.debug(`Saved ${events.length} PEPL events to database`);
  }

  /**
   * Get ingestion statistics
   */
  async getIngestionStats(): Promise<{
    lastProcessedBlock: number;
    lastIngestionAt: Date;
    status: string;
    totalPeplEvents: number;
  }> {
    const state = await this.stateManager.getState(this.SERVICE_NAME);

    // Count only PEPL events (filter by feeType)
    const totalPeplEvents = await this.moneyMarketRepository
      .createQueryBuilder('mm')
      .where("mm.fee_by_transfer::jsonb @> '[{\"feeType\": \"PEPL_LIQUIDATION_PROFIT\"}]'")
      .getCount();

    return {
      lastProcessedBlock: state?.lastProcessedBlock || 0,
      lastIngestionAt: state?.lastIngestionAt
        ? new Date(state.lastIngestionAt)
        : new Date(),
      status: state?.status || 'unknown',
      totalPeplEvents,
    };
  }

  /**
   * Legacy method name for backwards compatibility
   * @deprecated Use ingest() instead
   */
  async ingestPeplLiquidationProfits(): Promise<void> {
    return this.ingest();
  }
}

import { Repository } from 'typeorm';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import { StateManagerService } from '../../common/services/state-manager.service';
import { AppConfig } from '../../config/app.config';
import { HsmRevenueRaw } from '../../database/entities/hsm-revenue-raw.entity';
import { GraphqlClientService } from '../../graphql-client/graphql-client.service';
import { HsmRevenueCalculatorService } from './hsm-revenue-calculator.service';
import { HsmRevenueFetcherService } from './hsm-revenue-fetcher.service';
import { HsmRevenueTransformerService } from './hsm-revenue-transformer.service';

/**
 * Orchestrator for HSM revenue ingestion
 * Implements continuous batch processing strategy (matches PEPL pattern):
 * 1. Fetch facilitator events + account balances (ordered by block height)
 * 2. Calculate normalized revenues
 * 3. Transform and save to database
 * 4. Update state with highest block processed
 * 5. Loop until caught up or no more events
 *
 * Uses separate state tracking from other Hollar/money market data
 */
@Injectable()
export class HsmRevenueOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(HsmRevenueOrchestratorService.name);
  private readonly SERVICE_NAME = 'hsm-revenue';
  private readonly batchSize: number;
  private isIngesting = false;

  constructor(
    private configService: ConfigService<AppConfig>,
    private fetcher: HsmRevenueFetcherService,
    private calculator: HsmRevenueCalculatorService,
    private transformer: HsmRevenueTransformerService,
    private graphqlClient: GraphqlClientService,
    private stateManager: StateManagerService,
    @InjectRepository(HsmRevenueRaw)
    private hsmRevenueRepository: Repository<HsmRevenueRaw>,
  ) {
    this.batchSize = 100; // Fixed batch size as per requirements
  }

  async onModuleInit() {
    // Initialize Redis state if it doesn't exist
    const startBlock =
      this.configService.get('hsmRevenue.startBlock', { infer: true }) ||
      1_000_000;

    await this.stateManager.initializeState(this.SERVICE_NAME, startBlock);

    this.logger.log(
      `HSM Revenue Orchestrator initialized with start block: ${startBlock}, batch size: ${this.batchSize}`,
    );
  }

  /**
   * Main ingestion method - processes HSM revenue from last processed block
   */
  async ingest(): Promise<void> {
    if (this.isIngesting) {
      this.logger.warn('HSM revenue ingestion already in progress, skipping');
      return;
    }

    this.isIngesting = true;

    try {
      const lastProcessedBlock = await this.getLastProcessedBlock();
      const currentBlock = await this.graphqlClient.getCurrentBlockHeight();

      this.logger.log(
        `Starting HSM revenue ingestion: last=${lastProcessedBlock}, current=${currentBlock}`,
      );

      if (lastProcessedBlock >= currentBlock) {
        this.logger.debug('No new blocks to process for HSM revenue');
        return;
      }

      // Process in batches
      let hasMore = true;
      let currentFromBlock = lastProcessedBlock;

      while (hasMore) {
        const result = await this.processBatch(
          currentFromBlock,
          this.batchSize,
        );

        if (!result.hasMore) {
          hasMore = false;
        } else {
          currentFromBlock = result.highestBlock;
        }

        if (currentFromBlock >= currentBlock) {
          hasMore = false;
        }
      }

      this.logger.log('HSM revenue ingestion completed successfully');
    } catch (error) {
      this.logger.error('HSM revenue ingestion failed', error.stack);
      await this.stateManager.setError(this.SERVICE_NAME, error.message);
      throw error;
    } finally {
      this.isIngesting = false;
    }
  }

  /**
   * Process a batch of HSM revenue events
   */
  private async processBatch(
    fromBlock: number,
    batchSize: number,
  ): Promise<{ hasMore: boolean; highestBlock: number }> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Processing HSM revenue batch: fromBlock=${fromBlock}, batchSize=${batchSize}`,
      );

      // Step 1: Fetch data from both GraphQL sources
      const { facilitatorEvents, accountBalances, totalCount } =
        await this.fetcher.fetchHsmRevenueData(fromBlock, batchSize);

      if (facilitatorEvents.length === 0) {
        this.logger.debug(
          `No HSM revenue events found after block ${fromBlock}`,
        );
        return { hasMore: false, highestBlock: fromBlock };
      }

      this.logger.log(
        `Fetched ${facilitatorEvents.length} facilitator events, ${accountBalances.size} account balances (total: ${totalCount})`,
      );

      // Step 2: Calculate revenues
      const calculatedRevenues = this.calculator.calculateBatchRevenues(
        facilitatorEvents,
        accountBalances,
      );

      // Step 3: Transform to entities
      const entities = this.transformer.transformToEntities(
        facilitatorEvents,
        calculatedRevenues,
      );

      // Step 4: Save to database
      if (entities.length > 0) {
        await this.saveHsmRevenueBatch(entities);
      }

      // Step 5: Update state
      const highestBlockInBatch =
        this.fetcher.getMaxBlockHeight(facilitatorEvents);
      await this.stateManager.updateLastBlock(
        this.SERVICE_NAME,
        highestBlockInBatch,
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `Batch completed in ${duration}ms: ${entities.length} HSM revenue events saved, highest block: ${highestBlockInBatch}`,
      );

      const hasMore = facilitatorEvents.length === batchSize;
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
   * Save HSM revenue events to database in batch
   */
  private async saveHsmRevenueBatch(entities: HsmRevenueRaw[]): Promise<void> {
    try {
      const chunkSize = 500;
      for (let i = 0; i < entities.length; i += chunkSize) {
        const chunk = entities.slice(i, i + chunkSize);
        await this.hsmRevenueRepository.save(chunk, { chunk: chunkSize });
      }

      this.logger.debug(
        `Saved ${entities.length} HSM revenue events to database`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to save HSM revenue events to database',
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get last processed block from Redis
   */
  private async getLastProcessedBlock(): Promise<number> {
    const lastBlock = await this.stateManager.getLastProcessedBlock(
      this.SERVICE_NAME,
    );

    if (lastBlock === null) {
      const startBlock =
        this.configService.get('hsmRevenue.startBlock', { infer: true }) ||
        1_000_000;
      return startBlock - 1;
    }

    return lastBlock;
  }
}

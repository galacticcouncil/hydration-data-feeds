import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import { StateManagerService } from '../../common/services/state-manager.service';
import { AppConfig } from '../../config/app.config';
import { BorrowAprRaw } from '../../database/entities/borrow-apr-raw.entity';
import { GraphqlClientService } from '../../graphql-client/services/graphql-client.service';
import { BorrowAprFetcherService } from './borrow-apr-fetcher.service';
import { BorrowAprTransformerService } from './borrow-apr-transformer.service';
import { getMaxBlockHeight } from '../../common/utils/block-height.utils';
import { saveInChunks } from '../../common/utils/repository.utils';
import { BaseOrchestratorService } from '../../common/services/base-orchestrator.service';

/**
 * Orchestrator for Borrow APR ingestion
 * Implements continuous batch processing strategy (matches HSM revenue pattern):
 * 1. Fetch transfers from `transfers` table filtered by toId and assetId
 * 2. Normalize amounts using asset decimals
 * 3. Fetch spot prices and compute USD values
 * 4. Transform and save to borrow_apr_raw
 * 5. Update state with highest block processed
 * 6. Loop until caught up or no more transfers
 *
 * Uses separate state tracking from other ingestion pipelines
 */
@Injectable()
export class BorrowAprOrchestratorService extends BaseOrchestratorService {
  protected readonly SERVICE_NAME = 'borrow-apr';
  private readonly batchSize: number;

  constructor(
    private configService: ConfigService<AppConfig>,
    private fetcher: BorrowAprFetcherService,
    private transformer: BorrowAprTransformerService,
    private graphqlClient: GraphqlClientService,
    stateManager: StateManagerService,
    @InjectRepository(BorrowAprRaw)
    private borrowAprRepository: Repository<BorrowAprRaw>,
  ) {
    super(stateManager);
    this.batchSize =
      this.configService.get('borrowApr.batchSize', { infer: true }) ?? 1000;
  }

  protected getStartBlock(): number {
    return this.configService.get('borrowApr.startBlock', { infer: true }) ?? 1_000_000;
  }

  async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.logger.log(
      `Borrow APR Orchestrator initialized with start block: ${this.getStartBlock()}, batch size: ${this.batchSize}`,
    );
  }

  /**
   * Main ingestion method - processes Borrow APR transfers from last processed block
   */
  async ingest(): Promise<void> {
    if (this.isIngesting) {
      this.logger.warn('Borrow APR ingestion already in progress, skipping');
      return;
    }

    this.isIngesting = true;

    try {
      const lastProcessedBlock = await this.getLastProcessedBlock();
      const currentBlock = await this.graphqlClient.getCurrentBlockHeight();

      this.logger.log(
        `Starting Borrow APR ingestion: last=${lastProcessedBlock}, current=${currentBlock}`,
      );

      if (lastProcessedBlock >= currentBlock) {
        this.logger.debug('No new blocks to process for Borrow APR');
        return;
      }

      let hasMore = true;
      let currentFromBlock = lastProcessedBlock;
      let completedNaturally = false;

      while (hasMore) {
        const result = await this.processBatch(currentFromBlock, currentBlock, this.batchSize);

        if (!result.hasMore) {
          hasMore = false;
          completedNaturally = true;
        } else {
          currentFromBlock = result.highestBlock;
        }

        if (currentFromBlock >= currentBlock) {
          hasMore = false;
        }
      }

      // Advance to currentBlock only on natural completion (no more data found in range),
      // so the next run skips the already-scanned empty range. When the safety guard fires,
      // processBatch already updated state to the highest processed block.
      if (completedNaturally) {
        await this.stateManager.updateLastBlock(this.SERVICE_NAME, currentBlock);
      }

      this.logger.log('Borrow APR ingestion completed successfully');
    } catch (error) {
      this.logger.error('Borrow APR ingestion failed', error.stack);
      await this.stateManager.setError(this.SERVICE_NAME, error.message);
      throw error;
    } finally {
      this.isIngesting = false;
    }
  }

  /**
   * Process a batch of Borrow APR transfers
   */
  private async processBatch(
    fromBlock: number,
    currentBlock: number,
    batchSize: number,
  ): Promise<{ hasMore: boolean; highestBlock: number }> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Processing Borrow APR batch: fromBlock=${fromBlock}, batchSize=${batchSize}`,
      );

      // Step 1: Fetch transfers
      const { items: transfers, totalCount } =
        await this.fetcher.fetchBorrowAprTransfers(fromBlock, currentBlock, batchSize);

      if (transfers.length === 0) {
        this.logger.debug(
          `No Borrow APR transfers found after block ${fromBlock}`,
        );
        return { hasMore: false, highestBlock: fromBlock };
      }

      this.logger.log(
        `Fetched ${transfers.length} Borrow APR transfers (total: ${totalCount})`,
      );

      // Step 2: Transform to entities (normalizes amounts and fetches prices)
      const highestBlockInBatch = getMaxBlockHeight(transfers, fromBlock);

      const entities = await this.transformer.transformToEntities(
        transfers,
        highestBlockInBatch,
      );

      // Step 3: Save to database
      if (entities.length > 0) {
        await this.saveBatch(entities);
      }

      // Step 4: Update state
      await this.stateManager.updateLastBlock(
        this.SERVICE_NAME,
        highestBlockInBatch,
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `Batch completed in ${duration}ms: ${entities.length} Borrow APR transfers saved, highest block: ${highestBlockInBatch}`,
      );

      const hasMore = transfers.length === batchSize;
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
   * Save Borrow APR entities to database in batch
   */
  private async saveBatch(entities: BorrowAprRaw[]): Promise<void> {
    await saveInChunks(this.borrowAprRepository, entities);
    this.logger.debug(`Saved ${entities.length} Borrow APR transfers to database`);
  }

}

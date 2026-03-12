import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { saveInChunks } from '../../common/utils/repository.utils';
import { AppConfig } from '../../config/app.config';
import { SwapRaw } from '../../database/entities/swap-raw.entity';
import { GraphqlFetcherService } from './graphql-fetcher.service';
import { FeeCalculatorService } from './fee-calculator.service';
import { SwapTransformerService } from './swap-transformer.service';
import { GraphqlClientService } from '../../graphql-client/graphql-client.service';
import { StateManagerService } from '../../common/services/state-manager.service';
import { BaseOrchestratorService } from '../../common/services/base-orchestrator.service';

@Injectable()
export class IngestionOrchestratorService extends BaseOrchestratorService {
  protected readonly SERVICE_NAME = 'swaps';

  constructor(
    private configService: ConfigService<AppConfig>,
    private graphqlFetcher: GraphqlFetcherService,
    private feeCalculator: FeeCalculatorService,
    private swapTransformer: SwapTransformerService,
    private graphqlClient: GraphqlClientService,
    stateManager: StateManagerService,
    @InjectRepository(SwapRaw)
    private swapRawRepository: Repository<SwapRaw>,
  ) {
    super(stateManager);
  }

  protected getStartBlock(): number {
    return this.configService.get('ingestion.startBlock', { infer: true }) || 9999990;
  }

  /**
   * Main ingestion method - processes swaps from last processed block to current
   */
  async ingest(): Promise<void> {
    if (this.isIngesting) {
      this.logger.warn('Ingestion already in progress, skipping...');
      return;
    }

    this.isIngesting = true;

    try {
      // Get last processed block
      const lastProcessedBlock = await this.getLastProcessedBlock();
      const currentBlock = await this.graphqlClient.getCurrentBlockHeight();

      this.logger.log(
        `Starting ingestion: last=${lastProcessedBlock}, current=${currentBlock}`,
      );

      if (lastProcessedBlock >= currentBlock) {
        this.logger.debug('No new blocks to process');
        return;
      }

      // Process in batches
      const batchSize = this.configService.get('ingestion.batchSize', {
        infer: true,
      }) || 100;

      for (
        let fromBlock = lastProcessedBlock + 1;
        fromBlock <= currentBlock;
        fromBlock += batchSize
      ) {
        const toBlock = Math.min(fromBlock + batchSize - 1, currentBlock);

        await this.processBatch(fromBlock, toBlock);
      }

      this.logger.log(`Ingestion completed successfully`);
    } catch (error) {
      this.logger.error('Ingestion failed', error.stack);
      await this.stateManager.setError(this.SERVICE_NAME, error.message);
      throw error;
    } finally {
      this.isIngesting = false;
    }
  }

  /**
   * Process a batch of blocks (100 blocks by default)
   */
  private async processBatch(
    fromBlock: number,
    toBlock: number,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Log if we're crossing the runtime upgrade boundary
      const upgradeBlock =
        this.configService.get('ingestion.omnipoolRuntimeUpgradeBlock', {
          infer: true,
        }) || 11394694;

      if (fromBlock < upgradeBlock && toBlock >= upgradeBlock) {
        this.logger.log(
          `⚠️  Processing batch spans Omnipool runtime upgrade at block ${upgradeBlock}`,
        );
      } else if (fromBlock === upgradeBlock) {
        this.logger.log(
          `🔄 Starting to process post-upgrade blocks (>= ${upgradeBlock}) using routedTrades query`,
        );
      }

      this.logger.log(`Processing batch: blocks ${fromBlock} to ${toBlock}`);

      // Step 1: Fetch swaps
      const swaps = await this.graphqlFetcher.fetchAllSwapsInRange(
        fromBlock,
        toBlock,
      );

      if (swaps.length === 0) {
        this.logger.debug(`No swaps found in blocks ${fromBlock}-${toBlock}`);
        await this.stateManager.updateLastBlock(this.SERVICE_NAME, toBlock);
        return;
      }

      // Step 2: Transform swaps with batch price fetching
      // Use the end block of the range for price lookups (most recent prices)
      const transformedSwaps = await this.swapTransformer.transformSwapsBatch(
        swaps,
        toBlock,
      );

      // Step 5: Batch insert to database
      if (transformedSwaps.length > 0) {
        await this.saveSwapsBatch(transformedSwaps);
      }

      // Step 6: Update ingestion state in Redis
      await this.stateManager.updateLastBlock(this.SERVICE_NAME, toBlock);

      const duration = Date.now() - startTime;
      this.logger.log(
        `Batch completed in ${duration}ms: ${transformedSwaps.length} swaps saved`,
      );
    } catch (error) {
      this.logger.error(
        `Batch processing failed for blocks ${fromBlock}-${toBlock}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Save swaps to database in batch
   */
  private async saveSwapsBatch(swaps: SwapRaw[]): Promise<void> {
    await saveInChunks(this.swapRawRepository, swaps);
    this.logger.debug(`Saved ${swaps.length} swaps to database`);
  }

  /**
   * Get ingestion statistics
   */
  async getIngestionStats(): Promise<{
    lastProcessedBlock: number;
    lastIngestionAt: Date;
    status: string;
    totalSwaps: number;
  }> {
    const state = await this.stateManager.getState(this.SERVICE_NAME);
    const totalSwaps = await this.swapRawRepository.count();

    return {
      lastProcessedBlock: state?.lastProcessedBlock || 0,
      lastIngestionAt: state?.lastIngestionAt
        ? new Date(state.lastIngestionAt)
        : new Date(),
      status: state?.status || 'unknown',
      totalSwaps,
    };
  }
}

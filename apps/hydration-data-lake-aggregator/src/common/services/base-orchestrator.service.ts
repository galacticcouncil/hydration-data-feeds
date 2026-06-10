import { Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppConfig } from '../../config/app.config';
import { StateManagerService } from './state-manager.service';

export abstract class BaseOrchestratorService implements OnModuleInit {
  protected readonly logger: Logger;
  protected isIngesting = false;
  protected hasDoneBackfillRefresh = false;

  protected abstract readonly SERVICE_NAME: string;
  protected abstract getStartBlock(): number;

  private readonly nearHeadBlocks: number;

  constructor(
    protected readonly stateManager: StateManagerService,
    configService: ConfigService<AppConfig>,
  ) {
    this.logger = new Logger(this.constructor.name);
    this.nearHeadBlocks = configService.get('nearHeadBlocks', { infer: true }) ?? 50;
  }

  async onModuleInit(): Promise<void> {
    await this.stateManager.initializeState(this.SERVICE_NAME, this.getStartBlock());
  }

  protected async getLastProcessedBlock(): Promise<number> {
    return this.stateManager.getLastProcessedBlockOrDefault(
      this.SERVICE_NAME,
      this.getStartBlock() - 1,
    );
  }

  protected async maybeRefreshCaggs(
    lastBlock: number,
    headBlock: number,
    refreshFn: () => Promise<void>,
  ): Promise<void> {
    if (this.hasDoneBackfillRefresh) return;
    if (headBlock - lastBlock > this.nearHeadBlocks) return;

    this.hasDoneBackfillRefresh = true;
    this.logger.log(`Near chain head (${headBlock - lastBlock} blocks behind), triggering CAGG backfill refresh`);
    try {
      await refreshFn();
    } catch (err) {
      this.hasDoneBackfillRefresh = false; // allow retry on next tick
      this.logger.error('CAGG backfill refresh failed', err.stack);
    }
  }
}

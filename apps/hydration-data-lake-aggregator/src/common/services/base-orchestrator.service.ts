import { Logger, OnModuleInit } from '@nestjs/common';

import { StateManagerService } from './state-manager.service';

export abstract class BaseOrchestratorService implements OnModuleInit {
  protected readonly logger: Logger;
  protected isIngesting = false;

  protected abstract readonly SERVICE_NAME: string;
  protected abstract getStartBlock(): number;

  constructor(protected readonly stateManager: StateManagerService) {
    this.logger = new Logger(this.constructor.name);
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
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

import { AppConfig } from '../../config/app.config';
import { BorrowAprOrchestratorService } from '../services/borrow-apr-orchestrator.service';

/**
 * Scheduler for periodic Borrow APR ingestion
 * Runs every minute to fetch and process new Borrow APR transfers
 */
@Injectable()
export class BorrowAprScheduler {
  private readonly logger = new Logger(BorrowAprScheduler.name);

  constructor(
    private readonly orchestrator: BorrowAprOrchestratorService,
    private readonly configService: ConfigService<AppConfig>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleBorrowAprIngestion() {
    const backfillOnStartup = this.configService.get(
      'borrowApr.backfillOnStartup',
      { infer: true },
    );

    if (!backfillOnStartup) {
      this.logger.debug(
        'Borrow APR ingestion is disabled (backfillOnStartup=false), skipping',
      );
      return;
    }

    try {
      this.logger.log('Starting Borrow APR ingestion');
      await this.orchestrator.ingest();
      this.logger.log('Completed Borrow APR ingestion');
    } catch (error) {
      this.logger.error(
        `Borrow APR ingestion failed: ${error.message}`,
        error.stack,
      );
    }
  }
}

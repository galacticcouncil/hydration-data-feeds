import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { AppConfig } from '../../config/app.config';
import { PeplLiquidationOrchestratorService } from '../services/pepl-liquidation-orchestrator.service';

/**
 * Scheduler for PEPL liquidation profit ingestion
 * Runs every minute to check for new PEPL events
 */
@Injectable()
export class PeplLiquidationScheduler {
  private readonly logger = new Logger(PeplLiquidationScheduler.name);

  constructor(
    private configService: ConfigService<AppConfig>,
    private peplOrchestrator: PeplLiquidationOrchestratorService,
  ) {}

  /**
   * Run PEPL ingestion every minute
   * Cron pattern: "second minute hour day month weekday"
   */
  @Cron('0 */1 * * * *', {
    name: 'pepl-liquidation-ingestion',
  })
  async handlePeplLiquidationIngestion() {
    const backfillOnStartup = this.configService.get(
      'peplLiquidation.backfillOnStartup',
      { infer: true },
    );

    if (!backfillOnStartup) {
      this.logger.debug('PEPL ingestion is disabled (backfillOnStartup=false), skipping');
      return;
    }

    try {
      await this.peplOrchestrator.ingest();
    } catch (error) {
      this.logger.error('Scheduled PEPL ingestion failed', error.stack);
    }
  }

  /**
   * Log ingestion statistics every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'pepl-liquidation-ingestion-stats',
  })
  async logIngestionStats() {
    try {
      const stats = await this.peplOrchestrator.getIngestionStats();

      this.logger.log(
        `PEPL Stats - Block: ${stats.lastProcessedBlock}, Status: ${stats.status}`,
      );
    } catch (error) {
      this.logger.error('Failed to log PEPL ingestion stats', error.stack);
    }
  }
}

import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Cron,
  CronExpression,
} from '@nestjs/schedule';

import { AppConfig } from '../../config/app.config';
import {
  PeplLiquidationOrchestratorService,
} from '../services/pepl-liquidation-orchestrator.service';

/**
 * Scheduler for PEPL liquidation profit ingestion
 * Runs every 5 minutes to check for new PEPL events
 */
@Injectable()
export class PeplLiquidationScheduler {
  private readonly logger = new Logger(PeplLiquidationScheduler.name);
  private isRunning = false;

  constructor(
    private configService: ConfigService<AppConfig>,
    private peplOrchestrator: PeplLiquidationOrchestratorService,
  ) {}

  /**
   * Run PEPL ingestion every 5 minutes
   * Cron pattern: "second minute hour day month weekday"
   */
  @Cron('0 */1 * * * *', {
    name: 'pepl-liquidation-ingestion',
  })
  async handleIngestionCron() {
    if (this.isRunning) {
      this.logger.debug(
        'PEPL ingestion already running, skipping scheduled run',
      );
      return;
    }

    this.isRunning = true;

    try {
      const intervalSeconds = this.configService.get(
        'peplLiquidation.intervalSeconds',
        { infer: true },
      );

      this.logger.debug(
        `Starting scheduled PEPL ingestion (interval: ${intervalSeconds}s)`,
      );

      await this.peplOrchestrator.ingest();

      this.logger.debug('Scheduled PEPL ingestion completed successfully');
    } catch (error) {
      this.logger.error('Scheduled PEPL ingestion failed', error.stack);
    } finally {
      this.isRunning = false;
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
        `PEPL Stats - Block: ${stats.lastProcessedBlock}, ` +
          `Status: ${stats.status}, Total PEPL Events: ${stats.totalPeplEvents}`,
      );
    } catch (error) {
      this.logger.error('Failed to log PEPL ingestion stats', error.stack);
    }
  }
}

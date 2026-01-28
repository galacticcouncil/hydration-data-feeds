import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/app.config';
import { IngestionOrchestratorService } from '../services/ingestion-orchestrator.service';

@Injectable()
export class IngestionScheduler {
  private readonly logger = new Logger(IngestionScheduler.name);
  private isRunning = false;

  constructor(
    private configService: ConfigService<AppConfig>,
    private ingestionOrchestrator: IngestionOrchestratorService,
  ) {}

  /**
   * Run ingestion every minute
   * Cron pattern: "second minute hour day month weekday"
   */
  @Cron('0 * * * * *', {
    name: 'swap-ingestion',
  })
  async handleIngestionCron() {
    // Check if backfill/ingestion is enabled
    const backfillOnStartup = this.configService.get(
      'ingestion.backfillOnStartup',
      { infer: true },
    );

    if (!backfillOnStartup) {
      this.logger.debug('Ingestion is disabled (backfillOnStartup=false), skipping');
      return;
    }

    if (this.isRunning) {
      this.logger.debug('Ingestion already running, skipping scheduled run');
      return;
    }

    this.isRunning = true;

    try {
      const intervalSeconds = this.configService.get(
        'ingestion.intervalSeconds',
        { infer: true },
      );

      this.logger.debug(
        `Starting scheduled ingestion (interval: ${intervalSeconds}s)`,
      );

      await this.ingestionOrchestrator.ingest();

      this.logger.debug('Scheduled ingestion completed successfully');
    } catch (error) {
      this.logger.error('Scheduled ingestion failed', error.stack);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Log ingestion statistics every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'ingestion-stats',
  })
  async logIngestionStats() {
    try {
      const stats = await this.ingestionOrchestrator.getIngestionStats();

      this.logger.log(
        `Ingestion Stats - Block: ${stats.lastProcessedBlock}, ` +
          `Status: ${stats.status}, Total Swaps: ${stats.totalSwaps}`,
      );
    } catch (error) {
      this.logger.error('Failed to log ingestion stats', error.stack);
    }
  }
}

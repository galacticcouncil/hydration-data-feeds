import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/app.config';
import { IngestionOrchestratorService } from '../services/ingestion-orchestrator.service';

@Injectable()
export class SwapIngestionScheduler {
  private readonly logger = new Logger(SwapIngestionScheduler.name);

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
  async handleSwapIngestion() {
    const backfillOnStartup = this.configService.get(
      'ingestion.backfillOnStartup',
      { infer: true },
    );

    if (!backfillOnStartup) {
      this.logger.debug('Ingestion is disabled (backfillOnStartup=false), skipping');
      return;
    }

    try {
      await this.ingestionOrchestrator.ingest();
    } catch (error) {
      this.logger.error('Scheduled ingestion failed', error.stack);
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

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { AppConfig } from '../../config/app.config';
import { AssetReserveOrchestratorService } from '../services/asset-reserve-orchestrator.service';

/**
 * Scheduler for Asset Reserve fee ingestion
 * Runs every minute to check for new Asset Reserve events
 */
@Injectable()
export class AssetReserveScheduler {
  private readonly logger = new Logger(AssetReserveScheduler.name);

  constructor(
    private configService: ConfigService<AppConfig>,
    private assetReserveOrchestrator: AssetReserveOrchestratorService,
  ) {}

  /**
   * Run Asset Reserve ingestion every minute
   * Cron pattern: "second minute hour day month weekday"
   */
  @Cron('0 */1 * * * *', {
    name: 'asset-reserve-ingestion',
  })
  async handleAssetReserveIngestion() {
    const backfillOnStartup = this.configService.get(
      'assetReserve.backfillOnStartup',
      { infer: true },
    );

    if (!backfillOnStartup) {
      this.logger.debug('Asset Reserve ingestion is disabled (backfillOnStartup=false), skipping');
      return;
    }

    try {
      await this.assetReserveOrchestrator.ingest();
    } catch (error) {
      this.logger.error('Scheduled Asset Reserve ingestion failed', error.stack);
    }
  }

  /**
   * Log ingestion statistics every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'asset-reserve-ingestion-stats',
  })
  async logIngestionStats() {
    try {
      const stats = await this.assetReserveOrchestrator.getIngestionStats();

      this.logger.log(
        `Asset Reserve Stats - Block: ${stats.lastProcessedBlock}, Status: ${stats.status}`,
      );
    } catch (error) {
      this.logger.error('Failed to log Asset Reserve ingestion stats', error.stack);
    }
  }
}

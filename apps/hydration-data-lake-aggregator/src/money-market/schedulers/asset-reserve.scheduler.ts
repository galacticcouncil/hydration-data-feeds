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
  AssetReserveOrchestratorService,
} from '../services/asset-reserve-orchestrator.service';

/**
 * Scheduler for Asset Reserve fee ingestion
 * Runs every 5 minutes to check for new Asset Reserve events
 */
@Injectable()
export class AssetReserveScheduler {
  private readonly logger = new Logger(AssetReserveScheduler.name);
  private isRunning = false;

  constructor(
    private configService: ConfigService<AppConfig>,
    private assetReserveOrchestrator: AssetReserveOrchestratorService,
  ) {}

  /**
   * Run Asset Reserve ingestion every 5 minutes
   * Cron pattern: "second minute hour day month weekday"
   */
  @Cron('0 */1 * * * *', {
    name: 'asset-reserve-ingestion',
  })
  async handleIngestionCron() {
    if (this.isRunning) {
      this.logger.debug(
        'Asset Reserve ingestion already running, skipping scheduled run',
      );
      return;
    }

    this.isRunning = true;

    try {
      const intervalSeconds = this.configService.get(
        'assetReserve.intervalSeconds',
        { infer: true },
      );

      this.logger.debug(
        `Starting scheduled Asset Reserve ingestion (interval: ${intervalSeconds}s)`,
      );

      await this.assetReserveOrchestrator.ingest();

      this.logger.debug('Scheduled Asset Reserve ingestion completed successfully');
    } catch (error) {
      this.logger.error('Scheduled Asset Reserve ingestion failed', error.stack);
    } finally {
      this.isRunning = false;
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
        `Asset Reserve Stats - Block: ${stats.lastProcessedBlock}, ` +
          `Status: ${stats.status}, Total Asset Reserve Events: ${stats.totalAssetReserveEvents}`,
      );
    } catch (error) {
      this.logger.error('Failed to log Asset Reserve ingestion stats', error.stack);
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/app.config';
import { MoneyMarketOrchestratorService } from '../services/money-market-orchestrator.service';

/**
 * Scheduler for money market liquidation fee ingestion
 * Runs every minute to check for new liquidations
 */
@Injectable()
export class MoneyMarketIngestionScheduler {
  private readonly logger = new Logger(MoneyMarketIngestionScheduler.name);
  private isRunning = false;

  constructor(
    private configService: ConfigService<AppConfig>,
    private moneyMarketOrchestrator: MoneyMarketOrchestratorService,
  ) {}

  /**
   * Run money market ingestion every minute
   * Cron pattern: "second minute hour day month weekday"
   */
  @Cron('0 * * * * *', {
    name: 'money-market-ingestion',
  })
  async handleIngestionCron() {
    if (this.isRunning) {
      this.logger.debug(
        'Money market ingestion already running, skipping scheduled run',
      );
      return;
    }

    this.isRunning = true;

    try {
      const intervalSeconds = this.configService.get(
        'moneyMarket.intervalSeconds',
        { infer: true },
      );

      this.logger.debug(
        `Starting scheduled money market ingestion (interval: ${intervalSeconds}s)`,
      );

      await this.moneyMarketOrchestrator.ingest();

      this.logger.debug('Scheduled money market ingestion completed successfully');
    } catch (error) {
      this.logger.error('Scheduled money market ingestion failed', error.stack);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Log ingestion statistics every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'money-market-ingestion-stats',
  })
  async logIngestionStats() {
    try {
      const stats = await this.moneyMarketOrchestrator.getIngestionStats();

      this.logger.log(
        `Money Market Stats - Block: ${stats.lastProcessedBlock}, ` +
          `Status: ${stats.status}, Total Liquidations: ${stats.totalLiquidations}`,
      );
    } catch (error) {
      this.logger.error('Failed to log money market ingestion stats', error.stack);
    }
  }
}

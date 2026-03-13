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
  async handleMoneyMarketIngestion() {
    const backfillOnStartup = this.configService.get(
      'moneyMarket.backfillOnStartup',
      { infer: true },
    );

    if (!backfillOnStartup) {
      this.logger.debug('Money market ingestion is disabled (backfillOnStartup=false), skipping');
      return;
    }

    try {
      await this.moneyMarketOrchestrator.ingest();
    } catch (error) {
      this.logger.error('Scheduled money market ingestion failed', error.stack);
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
        `Money Market Stats - Block: ${stats.lastProcessedBlock}, Status: ${stats.status}`,
      );
    } catch (error) {
      this.logger.error('Failed to log money market ingestion stats', error.stack);
    }
  }
}

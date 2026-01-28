import {
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  Cron,
  CronExpression,
} from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/app.config';

import {
  HsmRevenueOrchestratorService,
} from '../services/hsm-revenue-orchestrator.service';

/**
 * Scheduler for periodic HSM revenue ingestion
 * Runs every minute to fetch and process new HSM revenue data
 */
@Injectable()
export class HsmRevenueScheduler {
  private readonly logger = new Logger(HsmRevenueScheduler.name);

  constructor(
    private readonly orchestrator: HsmRevenueOrchestratorService,
    private readonly configService: ConfigService<AppConfig>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleHsmRevenueIngestion() {
    // Check if backfill/ingestion is enabled
    const backfillOnStartup = this.configService.get(
      'hsmRevenue.backfillOnStartup',
      { infer: true },
    );

    if (!backfillOnStartup) {
      this.logger.debug('HSM revenue ingestion is disabled (backfillOnStartup=false), skipping');
      return;
    }

    try {
      this.logger.log('Starting HSM revenue ingestion');
      await this.orchestrator.ingest();
      this.logger.log('Completed HSM revenue ingestion');
    } catch (error) {
      this.logger.error(
        `HSM revenue ingestion failed: ${error.message}`,
        error.stack,
      );
    }
  }
}

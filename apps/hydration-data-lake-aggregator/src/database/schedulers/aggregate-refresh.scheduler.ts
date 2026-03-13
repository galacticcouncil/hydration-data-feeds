import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AggregateRefreshService } from '../services/aggregate-refresh.service';

@Injectable()
export class AggregateRefreshScheduler {
  private readonly logger = new Logger(AggregateRefreshScheduler.name);

  constructor(private readonly aggregateRefreshService: AggregateRefreshService) {}

  // Runs daily at 00:05 UTC — slight offset avoids contention with midnight ingestion ticks
  @Cron('5 0 * * *')
  async handleDailyAggregateRefresh() {
    try {
      await this.aggregateRefreshService.refreshAll();
    } catch (error) {
      this.logger.error(`Daily aggregate refresh failed: ${error.message}`, error.stack);
    }
  }
}

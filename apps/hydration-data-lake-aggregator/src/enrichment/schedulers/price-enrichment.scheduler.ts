import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PriceEnrichmentService } from '../services/price-enrichment.service';

@Injectable()
export class PriceEnrichmentScheduler {
  private readonly logger = new Logger(PriceEnrichmentScheduler.name);
  private isRunning = false;

  constructor(private priceEnrichmentService: PriceEnrichmentService) {}

  /**
   * Main enrichment cron job
   * Runs every 2 minutes at :30 seconds (e.g., 12:00:30, 12:02:30, 12:04:30)
   * Guards against concurrent runs
   */
  @Cron('30 */2 * * * *', {
    name: 'price-enrichment',
  })
  async handleEnrichmentCron() {
    if (this.isRunning) {
      this.logger.debug('Enrichment already running, skipping');
      return;
    }

    this.isRunning = true;

    try {
      this.logger.debug('Starting price enrichment batch');

      const stats =
        await this.priceEnrichmentService.enrichNextBatch();

      this.logger.log(
        `Enrichment completed: ${stats.enriched}/${stats.processed} enriched, ${stats.failed} failed`,
      );
    } catch (error) {
      this.logger.error('Price enrichment failed', error.stack);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Stats logging cron job
   * Runs every 10 minutes
   * Helps monitor enrichment progress
   */
  @Cron('0 */10 * * * *', {
    name: 'enrichment-stats',
  })
  async logEnrichmentStats() {
    try {
      const stats =
        await this.priceEnrichmentService.getEnrichmentStats();

      this.logger.log(
        `Enrichment Stats - Total: ${stats.totalSwaps}, ` +
          `Enriched: ${stats.enrichedSwaps}, ` +
          `Pending: ${stats.pendingSwaps}`,
      );
    } catch (error) {
      this.logger.error('Failed to log enrichment stats', error.stack);
    }
  }
}

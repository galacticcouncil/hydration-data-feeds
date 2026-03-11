import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  AaveFacilitatorHistoricalDataNode,
} from '../../graphql-client/types/graphql-response.types';
import { normalizeAmount } from '../../common/utils/amount.utils';

export interface CalculatedHsmRevenue {
  bucketLevel: string; // Normalized to 18 decimals
  totalTransferableNorm: string; // From account balance
  hsmRevenue: string; // Calculated difference
}

/**
 * Service responsible for normalizing bucket level and calculating HSM revenue
 * Performs: bucketLevel normalization (raw -> 18 decimals) + revenue calculation
 */
@Injectable()
export class HsmRevenueCalculatorService {
  private readonly logger = new Logger(HsmRevenueCalculatorService.name);
  private readonly BUCKET_LEVEL_DECIMALS = 18;

  /**
   * Calculate HSM revenue for a single event
   *
   * @param event - Aave facilitator event
   * @param totalTransferableNorm - Account balance at same block (already normalized)
   * @returns Calculated revenue components (saves with null values if data missing for later enrichment)
   */
  calculateEventRevenue(
    event: AaveFacilitatorHistoricalDataNode,
    totalTransferableNorm: string | undefined,
  ): CalculatedHsmRevenue {
    const normalizedBucketLevel = normalizeAmount(event.bucketLevel, this.BUCKET_LEVEL_DECIMALS);

    // If account balance is missing, save with null values for later enrichment
    if (!totalTransferableNorm) {
      this.logger.warn(
        `Missing account balance for event ${event.id} at block ${event.paraBlockHeight}, saving with null values for later enrichment`,
      );
      return {
        bucketLevel: normalizedBucketLevel,
        totalTransferableNorm: '0', // Default to 0 for missing data
        hsmRevenue: '0', // Default to 0 for missing data
      };
    }

    // Calculate revenue: totalTransferableNorm - bucketLevel
    const bucketLevelBig = parseFloat(normalizedBucketLevel);
    const totalTransferableBig = parseFloat(totalTransferableNorm);
    const hsmRevenue = totalTransferableBig - bucketLevelBig;

    return {
      bucketLevel: normalizedBucketLevel,
      totalTransferableNorm,
      hsmRevenue: hsmRevenue.toString(),
    };
  }

  /**
   * Process batch of events and calculate revenues
   *
   * @param events - Facilitator events
   * @param accountBalances - Map of block height to account balance
   * @returns Map of event ID to calculated revenue
   */
  calculateBatchRevenues(
    events: AaveFacilitatorHistoricalDataNode[],
    accountBalances: Map<number, string>,
  ): Map<string, CalculatedHsmRevenue> {
    const revenueMap = new Map<string, CalculatedHsmRevenue>();

    for (const event of events) {
      const accountBalance = accountBalances.get(event.paraBlockHeight);
      const revenue = this.calculateEventRevenue(event, accountBalance);
      revenueMap.set(event.id, revenue);
    }

    const missingCount = events.length - Array.from(revenueMap.values()).filter(
      r => r.totalTransferableNorm !== '0'
    ).length;

    this.logger.log(
      `Calculated revenue for ${revenueMap.size}/${events.length} HSM events (${missingCount} with missing data for later enrichment)`,
    );

    return revenueMap;
  }
}

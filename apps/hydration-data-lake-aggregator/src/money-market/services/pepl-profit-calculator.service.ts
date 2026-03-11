import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  AssetRegistryService,
} from '../../common/services/asset-registry.service';
import { normalizeAmount } from '../../common/utils/amount.utils';
import {
  PeplLiquidationEventNode,
} from '../../graphql-client/types/graphql-response.types';

/**
 * Service responsible for calculating and normalizing PEPL liquidation profits
 * Handles amount normalization using asset decimals
 */
@Injectable()
export class PeplProfitCalculatorService {
  private readonly logger = new Logger(PeplProfitCalculatorService.name);

  constructor(private readonly assetRegistry: AssetRegistryService) {}

  /**
   * Calculate normalized profit for a single event
   */
  async calculateEventProfit(
    event: PeplLiquidationEventNode,
    decimalsMap: Map<string, number>,
  ): Promise<{ assetId: string; normalizedAmount: string } | null> {
    let decimals = decimalsMap.get(event.debtAssetId);

    if (decimals === undefined || decimals === 0) {
      // Fallback: try individual lookup
      const fetchedDecimals = await this.assetRegistry.getDecimals(
        event.debtAssetId,
      );
      if (fetchedDecimals === null) {
        this.logger.warn(
          `Missing decimals for debt asset ${event.debtAssetId}, skipping event ${event.id}`,
        );
        return null;
      }
      decimals = fetchedDecimals;
    }

    const normalizedAmount = normalizeAmount(event.profit, decimals);

    return {
      assetId: event.debtAssetId,
      normalizedAmount,
    };
  }

  /**
   * Process batch of events and return normalized profits by asset
   * Returns a map of event ID to asset profits
   */
  async calculateBatchProfits(
    events: PeplLiquidationEventNode[],
  ): Promise<Map<string, Map<string, string>>> {
    // Map: eventId -> Map(assetId -> normalizedAmount)
    const eventProfits = new Map<string, Map<string, string>>();

    // Extract unique asset IDs for batch decimal lookup
    const assetIds = [...new Set(events.map((e) => e.debtAssetId))];
    const decimalsMap = await this.assetRegistry.getDecimalsBatch(assetIds);

    for (const event of events) {
      const profit = await this.calculateEventProfit(event, decimalsMap);

      if (profit) {
        const assetMap = new Map<string, string>();
        assetMap.set(profit.assetId, profit.normalizedAmount);
        eventProfits.set(event.id, assetMap);
      }
    }

    return eventProfits;
  }
}

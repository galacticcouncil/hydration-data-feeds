import { Injectable, Logger } from '@nestjs/common';
import { AssetReserveEventNode } from '../../graphql-client/types/graphql-response.types';
import { AssetRegistryService } from '../../common/services/asset-registry.service';
import { normalizeAmount } from '../../common/utils/amount.utils';

@Injectable()
export class AssetReserveCalculatorService {
  private readonly logger = new Logger(AssetReserveCalculatorService.name);

  constructor(private readonly assetRegistry: AssetRegistryService) {}

  /**
   * Calculate normalized amount for a single event
   */
  async calculateEventAmount(
    event: AssetReserveEventNode,
    decimalsMap: Map<string, number>,
  ): Promise<{ assetId: string; normalizedAmount: string } | null> {
    let decimals = decimalsMap.get(event.assetId);

    if (decimals === undefined) {
      // Fallback: try individual lookup
      const fetchedDecimals = await this.assetRegistry.getDecimals(
        event.assetId,
      );
      if (fetchedDecimals === null) {
        this.logger.warn(
          `Missing decimals for asset ${event.assetId}, skipping event ${event.id}`,
        );
        return null;
      }
      decimals = fetchedDecimals;
    }

    return {
      assetId: event.assetId,
      normalizedAmount: normalizeAmount(event.amount, decimals),
    };
  }

  /**
   * Process batch of events and return normalized amounts by asset
   * Returns a map of event ID to asset amounts
   */
  async calculateBatchAmounts(
    events: AssetReserveEventNode[],
  ): Promise<Map<string, Map<string, string>>> {
    // Map: eventId -> Map(assetId -> normalizedAmount)
    const eventAmounts = new Map<string, Map<string, string>>();

    // Extract unique asset IDs for batch decimal lookup
    const assetIds = [...new Set(events.map((e) => e.assetId))];
    const decimalsMap = await this.assetRegistry.getDecimalsBatch(assetIds);

    for (const event of events) {
      const amount = await this.calculateEventAmount(event, decimalsMap);

      if (amount) {
        const assetMap = new Map<string, string>();
        assetMap.set(amount.assetId, amount.normalizedAmount);
        eventAmounts.set(event.id, assetMap);
      }
    }

    return eventAmounts;
  }
}

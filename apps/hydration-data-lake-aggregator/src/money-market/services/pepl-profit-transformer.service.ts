import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  MoneyMarketRaw,
} from '../../database/entities/money-market-raw.entity';
import {
  PeplLiquidationEventNode,
} from '../../graphql-client/types/graphql-response.types';
import {
  AssetPriceMap,
  GraphqlFetcherService,
} from '../../ingestion/services/graphql-fetcher.service';

/**
 * Service responsible for transforming PEPL liquidation events into database entities
 * Maps calculated profits to MoneyMarketRaw entity structure
 */
@Injectable()
export class PeplProfitTransformerService {
  private readonly logger = new Logger(PeplProfitTransformerService.name);

  constructor(private graphqlFetcher: GraphqlFetcherService) {}

  /**
   * Transform a single PEPL liquidation event into a MoneyMarketRaw entity
   *
   * @param event - PEPL liquidation event
   * @param eventProfits - Normalized profits for this event
   * @param priceMap - Optional price map for batch processing
   * @returns MoneyMarketRaw entity ready for database insertion
   */
  private async transformEvent(
    event: PeplLiquidationEventNode,
    eventProfits: Map<string, string>,
    priceMap?: AssetPriceMap,
  ): Promise<MoneyMarketRaw | null> {
    if (!eventProfits || eventProfits.size === 0) {
      this.logger.warn(`No profits calculated for event ${event.id}, skipping`);
      return null;
    }

    // Build fee_asset_ids array - unique asset IDs involved in profit
    const feeAssetIds = Array.from(eventProfits.keys());

    // Build fee_amounts_raw { assetId: normalizedAmount }
    const feeAmountsRaw: Record<string, string> = {};
    for (const [assetId, amount] of eventProfits.entries()) {
      feeAmountsRaw[assetId] = amount;
    }

    // Build fee_by_transfer - single entry for PEPL profit
    // Structure matches existing format with fromId, toId, assetId, amount, feeType, transferEventId
    const feeByTransfer = [
      {
        fromId: 'protocol', // PEPL profit comes from protocol exposure
        toId: 'protocol', // Profit goes to protocol
        assetId: event.debtAssetId,
        amount: eventProfits.get(event.debtAssetId) || '0', // Normalized amount
        feeType: 'PEPL_LIQUIDATION_PROFIT' as const,
        transferEventId: event.event.id, // Event ID for traceability
      },
    ];

    // Fetch nearest prices if not provided in batch
    let spotPrices: Record<string, string> = {};
    if (priceMap) {
      // Use provided price map (batch-fetched for efficiency)
      for (const assetId of feeAssetIds) {
        const price = priceMap[assetId];
        if (price !== undefined) {
          spotPrices[assetId] = price;
        }
      }
    } else {
      // Fetch nearest historical prices for this block (handles sparse price data)
      try {
        const fetchedPrices = await this.graphqlFetcher.fetchNearestAssetPrices(
          feeAssetIds,
          event.paraBlockHeight,
        );

        // Log missing prices as warnings
        const missingAssetIds = feeAssetIds.filter((id) => !fetchedPrices[id]);
        if (missingAssetIds.length > 0) {
          this.logger.warn(
            `PEPL event ${event.id} at block ${event.paraBlockHeight}: ${missingAssetIds.length}/${feeAssetIds.length} assets have no historical prices: ${missingAssetIds.join(', ')}`,
          );
        }

        // Include all requested assets, using '0' for missing prices
        for (const assetId of feeAssetIds) {
          spotPrices[assetId] = fetchedPrices[assetId] || '0';
        }
      } catch (error) {
        this.logger.error(
          `Failed to fetch prices for PEPL event ${event.id} at block ${event.paraBlockHeight}: ${error.message}`,
        );
        // Use '0' for all assets on error
        for (const assetId of feeAssetIds) {
          spotPrices[assetId] = '0';
        }
      }
    }

    // Create entity with ALL required fields
    const entity = new MoneyMarketRaw();
    entity.time = new Date(event.event.block.timestamp);
    entity.liquidation_event_id = event.id;
    entity.block_height = event.paraBlockHeight;
    entity.liquidation_call_id = null; // PEPL events don't have liquidation_call_id
    entity.fee_asset_ids = feeAssetIds;
    entity.fee_amounts_raw = feeAmountsRaw;
    entity.fee_by_transfer = feeByTransfer;
    entity.fee_spot_prices = spotPrices;
    // ingested_at will be set automatically by DB default

    return entity;
  }

  /**
   * Transform PEPL liquidation events into MoneyMarketRaw entities
   * Fetches prices once for all events for efficiency
   *
   * IMPORTANT: Must populate ALL required fields to match existing money market structure:
   * - time: From event.block.timestamp
   * - liquidation_event_id: From event.id
   * - block_height: From event.paraBlockHeight
   * - liquidation_call_id: null for PEPL events
   * - fee_asset_ids: Array of unique asset IDs
   * - fee_amounts_raw: { assetId: normalizedAmount }
   * - fee_by_transfer: Array with proper structure matching existing format
   * - fee_spot_prices: { assetId: price_usd }
   *
   * @param events - PEPL liquidation events
   * @param normalizedProfits - Map of event ID to normalized profits
   * @param highestBlockHeight - Highest block height in the batch for price fetching
   * @returns Array of MoneyMarketRaw entities
   */
  async transformToEntities(
    events: PeplLiquidationEventNode[],
    normalizedProfits: Map<string, Map<string, string>>,
    highestBlockHeight?: number,
  ): Promise<MoneyMarketRaw[]> {
    this.logger.debug(`Transforming ${events.length} PEPL events`);

    // Fetch prices once for all events if block height is provided
    let priceMap: AssetPriceMap | undefined;
    if (highestBlockHeight && events.length > 0) {
      // Collect all unique asset IDs
      const allAssetIds = new Set<string>();
      for (const event of events) {
        const eventProfits = normalizedProfits.get(event.id);
        if (eventProfits) {
          eventProfits.forEach((_, assetId) => allAssetIds.add(assetId));
        }
      }

      priceMap = await this.graphqlFetcher.buildBatchPriceMap(
        Array.from(allAssetIds),
        highestBlockHeight,
      );
    }

    // Transform all events
    const transformedEvents = await Promise.all(
      events.map((event) => {
        const eventProfits = normalizedProfits.get(event.id);
        return this.transformEvent(event, eventProfits!, priceMap);
      }),
    );

    // Filter out null results
    const validEntities = transformedEvents.filter(
      (entity) => entity !== null,
    ) as MoneyMarketRaw[];

    this.logger.log(
      `Transformed ${validEntities.length}/${events.length} PEPL liquidation events into entities`,
    );
    return validEntities;
  }
}

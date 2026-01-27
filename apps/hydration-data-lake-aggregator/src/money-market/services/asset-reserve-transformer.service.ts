import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  MoneyMarketRaw,
} from '../../database/entities/money-market-raw.entity';
import {
  AssetReserveEventNode,
} from '../../graphql-client/types/graphql-response.types';
import {
  AssetPriceMap,
  GraphqlFetcherService,
} from '../../ingestion/services/graphql-fetcher.service';

/**
 * Service responsible for transforming Asset Reserve events into database entities
 * Maps calculated amounts to MoneyMarketRaw entity structure
 */
@Injectable()
export class AssetReserveTransformerService {
  private readonly logger = new Logger(AssetReserveTransformerService.name);

  constructor(private graphqlFetcher: GraphqlFetcherService) {}

  /**
   * Transform a single Asset Reserve event into a MoneyMarketRaw entity
   *
   * @param event - Asset Reserve event
   * @param eventAmounts - Normalized amounts for this event
   * @param priceMap - Optional price map for batch processing
   * @returns MoneyMarketRaw entity ready for database insertion
   */
  private async transformEvent(
    event: AssetReserveEventNode,
    eventAmounts: Map<string, string>,
    priceMap?: AssetPriceMap,
  ): Promise<MoneyMarketRaw | null> {
    if (!eventAmounts || eventAmounts.size === 0) {
      this.logger.warn(`No amounts calculated for event ${event.id}, skipping`);
      return null;
    }

    // Build fee_asset_ids array - unique asset IDs involved
    const feeAssetIds = Array.from(eventAmounts.keys());

    // Build fee_amounts_raw { assetId: normalizedAmount }
    const feeAmountsRaw: Record<string, string> = {};
    for (const [assetId, amount] of eventAmounts.entries()) {
      feeAmountsRaw[assetId] = amount;
    }

    // Build fee_by_transfer - single or dual entry for Asset Reserve
    // Structure matches existing format with fromId, toId, assetId, amount, feeType, transferEventId
    // Special case: If assetId is the Borrow APR asset, create two entries
    const BORROW_APR_ASSET_ID = '0x531a654d1696ed52e7275a8cede955e82620f99a';
    const isBorrowAprAsset = event.assetId === BORROW_APR_ASSET_ID;

    const feeByTransfer: Array<{
      fromId: string;
      toId: string;
      assetId: string;
      amount: string;
      feeType: 'LIQUIDATION_PENALTY' | 'PEPL_LIQUIDATION_PROFIT' | 'ASSET_RESERVE' | 'BORROW_APR' | 'OTHER';
      transferEventId: string;
      countInTotal?: boolean;
    }> = [
      {
        fromId: '0x0000000000000000000000000000000000000000000000000000000000000000', // Minted from money market
        toId: '0xe52567ff06acd6cbe7ba94dc777a3126e180b6d9', // Goes to treasury
        assetId: event.assetId,
        amount: eventAmounts.get(event.assetId) || '0', // Normalized amount
        feeType: 'ASSET_RESERVE' as const,
        transferEventId: event.eventId, // Event ID for traceability
        countInTotal: true, // Explicitly counted in total
      },
    ];

    // Add second entry for Borrow APR if this is the special asset
    if (isBorrowAprAsset) {
      feeByTransfer.push({
        fromId: '0x0000000000000000000000000000000000000000000000000000000000000000',
        toId: '0xe52567ff06acd6cbe7ba94dc777a3126e180b6d9',
        assetId: event.assetId,
        amount: eventAmounts.get(event.assetId) || '0',
        feeType: 'BORROW_APR' as const,
        transferEventId: event.eventId,
        countInTotal: false, // NOT counted in total to avoid double-counting
      });

      this.logger.debug(
        `Asset Reserve event ${event.id}: Detected Borrow APR asset, created dual entry`,
      );
    }

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
            `Asset Reserve event ${event.id} at block ${event.paraBlockHeight}: ${missingAssetIds.length}/${feeAssetIds.length} assets have no historical prices: ${missingAssetIds.join(', ')}`,
          );
        }

        // Include all requested assets, using '0' for missing prices
        for (const assetId of feeAssetIds) {
          spotPrices[assetId] = fetchedPrices[assetId] || '0';
        }
      } catch (error) {
        this.logger.error(
          `Failed to fetch prices for Asset Reserve event ${event.id} at block ${event.paraBlockHeight}: ${error.message}`,
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
    entity.liquidation_call_id = null; // Asset Reserve events don't have liquidation_call_id
    entity.fee_asset_ids = feeAssetIds;
    entity.fee_amounts_raw = feeAmountsRaw;
    entity.fee_by_transfer = feeByTransfer;
    entity.fee_spot_prices = spotPrices;
    // ingested_at will be set automatically by DB default

    return entity;
  }

  /**
   * Transform Asset Reserve events into MoneyMarketRaw entities
   * Fetches prices once for all events for efficiency
   *
   * IMPORTANT: Must populate ALL required fields to match existing money market structure:
   * - time: From event.block.timestamp
   * - liquidation_event_id: From event.id
   * - block_height: From event.paraBlockHeight
   * - liquidation_call_id: null for Asset Reserve events
   * - fee_asset_ids: Array of unique asset IDs
   * - fee_amounts_raw: { assetId: normalizedAmount }
   * - fee_by_transfer: Array with proper structure matching existing format
   * - fee_spot_prices: { assetId: price_usd }
   *
   * @param events - Asset Reserve events
   * @param normalizedAmounts - Map of event ID to normalized amounts
   * @param highestBlockHeight - Highest block height in the batch for price fetching
   * @returns Array of MoneyMarketRaw entities
   */
  async transformToEntities(
    events: AssetReserveEventNode[],
    normalizedAmounts: Map<string, Map<string, string>>,
    highestBlockHeight?: number,
  ): Promise<MoneyMarketRaw[]> {
    this.logger.debug(`Transforming ${events.length} Asset Reserve events`);

    // Fetch prices once for all events if block height is provided
    let priceMap: AssetPriceMap | undefined;
    if (highestBlockHeight && events.length > 0) {
      // Collect all unique asset IDs
      const allAssetIds = new Set<string>();
      for (const event of events) {
        const eventAmounts = normalizedAmounts.get(event.id);
        if (eventAmounts) {
          eventAmounts.forEach((_, assetId) => allAssetIds.add(assetId));
        }
      }

      try {
        const fetchedPrices = await this.graphqlFetcher.fetchNearestAssetPrices(
          Array.from(allAssetIds),
          highestBlockHeight,
        );

        // Log missing prices
        const missingAssetIds = Array.from(allAssetIds).filter(
          (id) => !fetchedPrices[id],
        );
        if (missingAssetIds.length > 0) {
          this.logger.warn(
            `Block ${highestBlockHeight}: ${missingAssetIds.length}/${allAssetIds.size} assets have no historical prices: ${missingAssetIds.join(', ')}`,
          );
        }

        // Build complete price map with '0' for missing prices
        priceMap = {};
        for (const assetId of allAssetIds) {
          priceMap[assetId] = fetchedPrices[assetId] || '0';
        }

        this.logger.debug(
          `Fetched ${Object.keys(fetchedPrices).length}/${allAssetIds.size} nearest prices for block ${highestBlockHeight}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to fetch batch prices for block ${highestBlockHeight}: ${error.message}`,
        );
        // Create price map with all '0' on error
        priceMap = {};
        for (const assetId of allAssetIds) {
          priceMap[assetId] = '0';
        }
      }
    }

    // Transform all events
    const transformedEvents = await Promise.all(
      events.map((event) => {
        const eventAmounts = normalizedAmounts.get(event.id);
        return this.transformEvent(event, eventAmounts!, priceMap);
      }),
    );

    // Filter out null results
    const validEntities = transformedEvents.filter(
      (entity) => entity !== null,
    ) as MoneyMarketRaw[];

    this.logger.log(
      `Transformed ${validEntities.length}/${events.length} Asset Reserve events into entities`,
    );
    return validEntities;
  }
}

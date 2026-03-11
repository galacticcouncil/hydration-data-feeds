import { Injectable, Logger } from '@nestjs/common';

import { AssetRegistryService } from '../../common/services/asset-registry.service';
import { normalizeAmount } from '../../common/utils/amount.utils';
import { BorrowAprRaw } from '../../database/entities/borrow-apr-raw.entity';
import { GraphqlFetcherService } from '../../ingestion/services/graphql-fetcher.service';
import { BorrowAprTransferNode } from '../../graphql-client/types/graphql-response.types';

// Treasury and zero address constants for direction detection
const BORROW_APR_TREASURY_ADDRESS = '8c0f3b9602374198974d2b2679d14a386f5b108e';
const ZERO_ADDRESS = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Service responsible for transforming Borrow APR transfers into database entities
 * - Normalizes raw amount using asset decimals (via AssetRegistryService)
 * - Fetches nearest spot prices (via GraphqlFetcherService)
 * - Computes SIGNED amounts based on transfer direction:
 *   - Incoming (TO treasury): positive amount, direction = 'IN'
 *   - Outgoing (FROM treasury TO zero): negative amount, direction = 'OUT'
 * - Net Borrow APR = SUM(signed amount * price) in continuous aggregates
 */
@Injectable()
export class BorrowAprTransformerService {
  private readonly logger = new Logger(BorrowAprTransformerService.name);

  constructor(
    private readonly assetRegistry: AssetRegistryService,
    private readonly graphqlFetcher: GraphqlFetcherService,
  ) {}

  /**
   * Transform Borrow APR transfers into BorrowAprRaw entities
   * Fetches asset decimals and prices once for the full batch
   *
   * @param transfers - Borrow APR transfer nodes from GraphQL
   * @param highestBlockHeight - Highest block height in the batch for price fetching
   * @returns Array of BorrowAprRaw entities ready for database insertion
   */
  async transformToEntities(
    transfers: BorrowAprTransferNode[],
    highestBlockHeight: number,
  ): Promise<BorrowAprRaw[]> {
    if (transfers.length === 0) return [];

    this.logger.debug(`Transforming ${transfers.length} Borrow APR transfers`);

    // Collect unique asset IDs (typically just one: the borrow APR asset)
    const assetIds = [...new Set(transfers.map((t) => t.assetId))];

    // Batch-fetch decimals for all assets
    const decimalsMap = await this.assetRegistry.getDecimalsBatch(assetIds);

    // Batch-fetch nearest spot prices at the highest block in the batch
    const priceMap = await this.graphqlFetcher.buildBatchPriceMap(assetIds, highestBlockHeight);

    const entities: BorrowAprRaw[] = [];

    for (const transfer of transfers) {
      const decimals = decimalsMap.get(transfer.assetId);

      if (decimals === undefined || decimals === null) {
        this.logger.warn(
          `Missing decimals for asset ${transfer.assetId}, skipping transfer ${transfer.eventId}`,
        );
        continue;
      }

      const normalizedAmount = normalizeAmount(transfer.amount, decimals);
      const spotPrice = priceMap[transfer.assetId] || '0';

      // Determine direction: incoming (TO treasury) or outgoing (FROM treasury TO zero)
      const isIncoming = transfer.toId.toLowerCase().includes(BORROW_APR_TREASURY_ADDRESS);
      const direction = isIncoming ? 'IN' : 'OUT';

      // Sign the amount: positive for incoming, negative for outgoing
      const signedAmount = isIncoming
        ? normalizedAmount
        : (-parseFloat(normalizedAmount)).toString();

      const entity = new BorrowAprRaw();
      entity.time = new Date(transfer.paraTimestamp);
      entity.block_height = transfer.paraBlockHeight;
      entity.event_id = transfer.eventId;
      entity.amount = signedAmount;
      entity.direction = direction;
      entity.asset_id = transfer.assetId;
      entity.fee_spot_prices = { [transfer.assetId]: spotPrice };

      entities.push(entity);
    }

    this.logger.log(
      `Transformed ${entities.length}/${transfers.length} Borrow APR transfers into entities`,
    );

    return entities;
  }
}

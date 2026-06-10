import { Injectable, Logger } from '@nestjs/common';

import { AssetRegistryService } from '../../common/services/asset-registry.service';
import { PriceFetcherService } from '../../common/services/price-fetcher.service';
import { BorrowAprRaw } from '../../database/entities/borrow-apr-raw.entity';
import { BorrowAprCalculatorService } from './borrow-apr-calculator.service';
import { BorrowAprTransferNode } from '../../graphql-client/types/graphql-response.types';

/**
 * Service responsible for transforming Borrow APR transfers into database entities
 * - Normalizes raw amount using asset decimals (via AssetRegistryService)
 * - Fetches nearest spot prices (via PriceFetcherService)
 * - Computes SIGNED amounts based on transfer direction (via BorrowAprCalculatorService):
 *   - Incoming (TO treasury): positive amount, direction = 'IN'
 *   - Outgoing (FROM treasury TO zero): negative amount, direction = 'OUT'
 * - Net Borrow APR = SUM(signed amount * price) in continuous aggregates
 */
@Injectable()
export class BorrowAprTransformerService {
  private readonly logger = new Logger(BorrowAprTransformerService.name);

  constructor(
    private readonly assetRegistry: AssetRegistryService,
    private readonly priceFetcher: PriceFetcherService,
    private readonly calculator: BorrowAprCalculatorService,
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
    const priceMap = await this.priceFetcher.buildBatchPriceMap(assetIds, highestBlockHeight);

    const entities: BorrowAprRaw[] = [];

    for (const transfer of transfers) {
      const decimals = decimalsMap.get(transfer.assetId);

      if (decimals === undefined || decimals === null) {
        this.logger.warn(
          `Missing decimals for asset ${transfer.assetId}, skipping transfer ${transfer.eventId}`,
        );
        continue;
      }

      const { signedAmount, direction } = this.calculator.calculate(transfer, decimals);
      const spotPrice = priceMap[transfer.assetId] || '0';

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

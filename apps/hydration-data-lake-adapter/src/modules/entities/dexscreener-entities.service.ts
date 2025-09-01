import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../config';
import { DexScreenerCacheProviderToken, GraphQlClientProviderToken } from '../../providers';
import { DexScreenerCacheProvider } from '../../providers/cache/dexscreener-cache.provider';
import {
  DexScreenerBlock,
  DexScreenerPair,
} from '../consumers/dexscreener/v1/dexscreener.interfaces';
import { DataSourceService } from '../dataSource/data-source.service';
import { BaseConsumerHelper } from '../consumers/base/base.helper';
import { DexScreenerTransformer } from '../consumers/dexscreener/v1/dexscreener.transformer';
import { DatasourceBlock } from '../dataSource/graphqlSupport/types';

@Injectable()
export class DexScreenerEntitiesService {
  private readonly logger = new Logger(DexScreenerEntitiesService.name, { timestamp: true });

  constructor(
    private appConfig: AppConfig,

    @Inject(DexScreenerCacheProviderToken)
    private dexScreenerCacheProvider: DexScreenerCacheProvider,

    private dataSourceService: DataSourceService,
    private dexScreenerTransformer: DexScreenerTransformer
  ) {}

  /**
   * Orders and pairs asset identifiers based on their type and format in ascending order.
   *
   * The function handles two types of asset identifiers:
   * - Numeric IDs: Pure numeric strings (e.g., "10", "420", "1000012")
   * - Hex addresses: Ethereum-style addresses starting with "0x"
   *
   * @param assetIds Array of asset identifier strings to be ordered
   * @returns Ordered array with consistent pairing logic
   *
   * @example
   * // Numeric pairs - sorted numerically
   * getPairAssetsOrdered(["10", "5"]) // returns ["5", "10"]
   * getPairAssetsOrdered(["420", "0"]) // returns ["0", "420"]
   *
   * // Hex pairs - sorted alphabetically (lowercase)
   * getPairAssetsOrdered([
   *   "0x8a598fe3e3a471ce865332e330d303502a0e2f52",
   *   "0xa8733d52c53ec96e44dd171dc6c2bff4f8132947"
   * ])
   *
   * // Mixed pairs - numeric ID always comes first
   * getPairAssetsOrdered([
   *   "0x8a598fe3e3a471ce865332e330d303502a0e2f52",
   *   "102"
   * ]) // returns ["102", "0x8a598fe3e3a471ce865332e330d303502a0e2f52"]
   */
  static getPairAssetsOrdered(assetIds: string[]) {
    const hexIds = assetIds
      .filter((id) => id.startsWith('0x'))
      .map((id) => id.toLowerCase())
      .sort();
    const numericIds = assetIds
      .filter((id) => !id.startsWith('0x') && /^\d+$/.test(id))
      .map((id) => Number.parseInt(id, 10))
      .sort((a, b) => a - b)
      .map((id) => `${id}`);

    if (hexIds.length > 1) return hexIds;
    if (numericIds.length > 1) return numericIds;

    if (hexIds.length === 1 && numericIds.length === 1) {
      return [...numericIds, ...hexIds];
    }

    // Fallback return value
    return assetIds.sort();
  }

  static getPairId(assetIds: string[], skipOrdering = false) {
    if (skipOrdering) return assetIds.join('-');
    return DexScreenerEntitiesService.getPairAssetsOrdered(assetIds).join('-');
  }

  /**
   * Retrieves a block by its height from the cache or creates a new block entity if it does not exist.
   * If the block is not present in the cache and the optional data parameter is not provided,
   * it attempts to fetch the block data from the data source service.
   *
   * Normally this method should persist Block entity in cache on "/latest-block" request and reuse
   * this entity in further processing steps. So one block will be fetched only once.
   */
  async getOrCreateBlock({ height, data }: { height: number; data?: DatasourceBlock }) {
    let blockEntity: DexScreenerBlock | undefined = await this.dexScreenerCacheProvider.getBlock(
      `${height}`
    );

    if (blockEntity) return blockEntity;

    const blockData = data
      ? [data]
      : await this.dataSourceService.getBlocksByHeightsList({
          heightsList: [height],
        });

    if (!blockData || blockData.length === 0) {
      throw new HttpException(
        BaseConsumerHelper.getErrorResponsePayload(
          `Block with height ${height} not found`,
          HttpStatus.NOT_FOUND
        ),
        HttpStatus.NOT_FOUND
      );
    }

    blockEntity = this.dexScreenerTransformer.transformBlock(blockData[0]);

    await this.dexScreenerCacheProvider.setBlock(`${blockEntity.blockNumber}`, blockEntity);

    return blockEntity;
  }

  async getOrCreatePair({ assetIds }: { assetIds: string[] }) {
    const pairIdsOrdered = DexScreenerEntitiesService.getPairAssetsOrdered(assetIds);
    const pairId = DexScreenerEntitiesService.getPairId(pairIdsOrdered, true);

    let pairEntity: DexScreenerPair | undefined =
      await this.dexScreenerCacheProvider.getPair(pairId);

    if (pairEntity) return pairEntity;

    pairEntity = {
      id: pairId,
      dexKey: this.appConfig.DEX_KEY,
      asset0Id: pairIdsOrdered[0],
      asset1Id: pairIdsOrdered[1],
    };

    await this.dexScreenerCacheProvider.setPair(`${pairEntity.id}`, pairEntity);

    return pairEntity;
  }
}

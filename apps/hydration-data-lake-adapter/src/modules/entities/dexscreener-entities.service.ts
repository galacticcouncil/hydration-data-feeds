import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../config';
import { DexScreenerCacheProviderToken } from '../../providers';
import { DexScreenerCacheProvider } from '../../providers/cache/dexscreener-cache.provider';
import {
  DexScreenerAsset,
  DexScreenerBlock,
  DexScreenerGenericPool,
  DexScreenerPair,
} from '../consumers/dexscreener/v1/dexscreener.interfaces';
import { DataSourceService } from '../dataSource/data-source.service';
import { BaseConsumerHelper } from '../consumers/base/base.helper';
import { DexScreenerTransformer } from '../consumers/dexscreener/v1/dexscreener.transformer';
import { DatasourceBlock } from '../dataSource/graphqlSupport/types';
import { ApiEndpoint, PoolType } from '../dataSource/types';

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

  static getPairId({
    pool,
    assetIds,
    skipOrdering = false,
  }: {
    pool: DexScreenerGenericPool;
    assetIds: string[];
    skipOrdering?: boolean;
  }) {
    const assetsToProcess = skipOrdering
      ? assetIds
      : DexScreenerEntitiesService.getPairAssetsOrdered(assetIds);

    switch (pool.poolType) {
      case PoolType.Stableswap:
      case PoolType.Omnipool:
      case PoolType.AAVE:
        return `${pool.id}-${assetsToProcess.join('-')}`;
      case PoolType.Xykpool:
        return pool.id;
      default:
        return `${assetsToProcess.join('-')}`;
    }
  }

  async getOrCreateLatestProcessedBlock({ data }: { data?: DatasourceBlock } = {}) {
    let latestProcBlockEntity: DexScreenerBlock | undefined =
      await this.dexScreenerCacheProvider.getLatestProcessedBlock();

    if (latestProcBlockEntity) return latestProcBlockEntity;

    const graphqlData = await this.dataSourceService.fetchLatestProcessedBlock({
      endpoint: ApiEndpoint.MAIN_INDEXER_API,
    });

    if (!graphqlData) {
      throw new HttpException(
        BaseConsumerHelper.getErrorResponsePayload('Latest block not found'),
        HttpStatus.NOT_FOUND
      );
    }

    latestProcBlockEntity = await this.getOrCreateBlock({
      height: graphqlData.height,
      data: graphqlData,
    });

    await this.dexScreenerCacheProvider.setLatestProcessedBlock(latestProcBlockEntity);

    return latestProcBlockEntity;
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
      : await this.dataSourceService.fetchBlocksByHeightsList({
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

  async getOrCreatePair({
    id,
    assetIds,
    poolAddress,
  }: {
    id?: string;
    assetIds?: string[];
    poolAddress: string;
  }) {
    let pairEntity: DexScreenerPair | undefined;

    if (id) pairEntity = await this.dexScreenerCacheProvider.getPair(id);

    if (pairEntity) return pairEntity;

    let assetIdsToProcess = assetIds;

    const poolData = await this.dataSourceService.fetchPoolByAccount({
      accountPubKey: poolAddress,
    });

    if (
      (!assetIdsToProcess || !assetIdsToProcess.length) &&
      poolData.accountType === PoolType.Xykpool
    ) {
      assetIdsToProcess = [poolData.xykpool.assetAId, poolData.xykpool.assetBId];
    }

    const genericPool = await this.getOrCreateGenericPool({
      id: poolAddress,
      data: { id: poolAddress, poolType: poolData.accountType as PoolType, assets: [] },
    });

    const pairIdsOrdered = DexScreenerEntitiesService.getPairAssetsOrdered(assetIdsToProcess);

    const pairId = DexScreenerEntitiesService.getPairId({
      pool: genericPool,
      assetIds: pairIdsOrdered,
      skipOrdering: true,
    });

    pairEntity = await this.dexScreenerCacheProvider.getPair(pairId);

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

  async getOrCreateAsset(id: string, blockHeight?: number) {
    let assetEntity: DexScreenerAsset | undefined =
      await this.dexScreenerCacheProvider.getAsset(id);

    if (assetEntity) return assetEntity;

    const blockHeightEnsured =
      blockHeight ?? (await this.getOrCreateLatestProcessedBlock()).blockNumber;

    // Fetch data from GraphQL API
    const assetData = await this.dataSourceService.fetchAssetById({
      id,
      endpoint: ApiEndpoint.MAIN_INDEXER_API,
    });

    if (!assetData) {
      throw new HttpException(
        BaseConsumerHelper.getErrorResponsePayload('Asset not found'),
        HttpStatus.NOT_FOUND
      );
    }

    const assetHistData = await this.dataSourceService.fetchAssetHistDataByBlockHeight({
      assetId: id,
      blockHeight: blockHeightEnsured,
      endpoint: ApiEndpoint.MAIN_INDEXER_API,
    });

    if (!assetHistData) {
      throw new HttpException(
        BaseConsumerHelper.getErrorResponsePayload('Asset Historical Data not found'),
        HttpStatus.NOT_FOUND
      );
    }

    assetEntity = this.dexScreenerTransformer.transformAsset({
      ...assetData,
      totalIssuance: assetHistData.totalIssuance,
    });

    await this.dexScreenerCacheProvider.setAsset(`${assetEntity.id}`, assetEntity);

    return assetEntity;
  }

  async getOrCreateGenericPool({
    id,
    data,
  }: {
    id: string;
    data?: DexScreenerGenericPool;
  }): Promise<DexScreenerGenericPool> {
    let poolEntity: DexScreenerGenericPool | undefined =
      await this.dexScreenerCacheProvider.getGenericPool(id);

    if (poolEntity) return poolEntity;

    if (!data) {
      throw new HttpException(
        BaseConsumerHelper.getErrorResponsePayload('Generic pool not found'),
        HttpStatus.NOT_FOUND
      );
    }

    poolEntity = {
      id: data.id,
      poolType: data.poolType,
      assets: data.assets,
    };

    await this.dexScreenerCacheProvider.setGenericPool(poolEntity.id, poolEntity);

    return poolEntity;
  }
}

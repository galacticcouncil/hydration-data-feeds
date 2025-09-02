import { Injectable, Logger, Provider } from '@nestjs/common';
import { AppConfig } from '../../modules/config';
import { MainIndexerCacheProviderToken } from '../index';
import { BaseCacheClient } from './base-cache.helper';
import {
  DatasourceAavepool,
  DatasourceAccountAssetBalanceHistoricalData,
  DatasourceAccountData,
  DatasourceAssetHistoricalData,
} from '../../modules/dataSource/graphqlSupport/types';

export enum MainIndexerCacheKeyPrefix {
  MAIN_IDNX_ACCOUNT_DATA = 'MAIN_IDNX_ACCOUNT_DATA',
  MAIN_IDNX_AAVEPOOL_DATA = 'MAIN_IDNX_AAVEPOOL_DATA',
  MAIN_IDNX_ACC_ASSET_BAL_HIST_DATA = 'MAIN_IDNX_ACC_ASSET_BAL_HIST_DATA',
  MAIN_IDNX_ASSET_HIST_DATA = 'MAIN_IDNX_ASSET_HIST_DATA',
}

@Injectable()
export class MainIndexerCacheProvider extends BaseCacheClient {
  private readonly logger = new Logger(MainIndexerCacheProvider.name, { timestamp: true });

  constructor(appConfig: AppConfig) {
    super(appConfig, { cacheTtlMs: appConfig.ENTITIES_CACHE_TTL_MS });
  }

  /**
   * ============================= A C C O U N T   D A T A =========================================
   */
  async setAccount(id: string, entity: DatasourceAccountData, ttlMs = 600_000) {
    try {
      await this.cache.set(
        `${MainIndexerCacheKeyPrefix.MAIN_IDNX_ACCOUNT_DATA}_${id}`,
        entity,
        ttlMs
      );
    } catch (e) {}
  }
  async getAccount(id: string): Promise<DatasourceAccountData | undefined> {
    try {
      return this.cache.get(`${MainIndexerCacheKeyPrefix.MAIN_IDNX_ACCOUNT_DATA}_${id}`);
    } catch (e) {}
    return;
  }

  /**
   * ================================== A A V E P O O L ============================================
   */
  async setAavepool(id: string, entity: DatasourceAavepool) {
    try {
      await this.cache.set(`${MainIndexerCacheKeyPrefix.MAIN_IDNX_AAVEPOOL_DATA}_${id}`, entity);
    } catch (e) {}
  }
  async getAavepool(id: string): Promise<DatasourceAavepool | undefined> {
    try {
      return this.cache.get(`${MainIndexerCacheKeyPrefix.MAIN_IDNX_AAVEPOOL_DATA}_${id}`);
    } catch (e) {}
    return;
  }

  /**
   * =========================== ACCOUNT ASSET BALANCE HIST DATA ===================================
   */
  async setAccountAssetBalanceHistDataAtBlock({
    address,
    assetId,
    blockHeight,
    entity,
    ttlMs = 1000 * 60 * 20,
  }: {
    address: string;
    assetId: string;
    blockHeight: number;
    entity: DatasourceAccountAssetBalanceHistoricalData;
    ttlMs?: number;
  }) {
    try {
      await this.cache.set(
        `${MainIndexerCacheKeyPrefix.MAIN_IDNX_ACC_ASSET_BAL_HIST_DATA}_${address}_${assetId}_${blockHeight}`,
        entity,
        ttlMs
      );
    } catch (e) {}
  }
  async getAccountAssetBalanceHistDataAtBlock({
    address,
    assetId,
    blockHeight,
  }: {
    address: string;
    assetId: string;
    blockHeight: number;
  }): Promise<DatasourceAccountAssetBalanceHistoricalData | undefined> {
    try {
      return this.cache.get(
        `${MainIndexerCacheKeyPrefix.MAIN_IDNX_ACC_ASSET_BAL_HIST_DATA}_${address}_${assetId}_${blockHeight}`
      );
    } catch (e) {}
    return;
  }

  /**
   * ============================= A S S E T   H I S T   D A T A ===================================
   */
  async setAssetHistDataAtBlock({
    assetId,
    blockHeight,
    entity,
    ttlMs = 1000 * 60 * 20,
  }: {
    assetId: string;
    blockHeight: number;
    entity: DatasourceAssetHistoricalData;
    ttlMs?: number;
  }) {
    try {
      await this.cache.set(
        `${MainIndexerCacheKeyPrefix.MAIN_IDNX_ASSET_HIST_DATA}_${assetId}_${blockHeight}`,
        entity,
        ttlMs
      );
    } catch (e) {}
  }
  async getAssetHistDataAtBlock({
    assetId,
    blockHeight,
  }: {
    assetId: string;
    blockHeight: number;
  }): Promise<DatasourceAssetHistoricalData | undefined> {
    try {
      return this.cache.get(
        `${MainIndexerCacheKeyPrefix.MAIN_IDNX_ASSET_HIST_DATA}_${assetId}_${blockHeight}`
      );
    } catch (e) {}
    return;
  }
}

export const MainIndexerCacheProviderFactory: Provider = {
  provide: MainIndexerCacheProviderToken,
  useClass: MainIndexerCacheProvider,
};

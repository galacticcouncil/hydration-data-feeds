import { Injectable, Logger, Provider } from '@nestjs/common';
import { AppConfig } from '../../modules/config';
import { DexScreenerCacheProviderToken } from '../index';
const Keyv = require('keyv');
import { BaseCacheClient } from './base-cache.helper';
import {
  DexScreenerAsset,
  DexScreenerBlock,
  DexScreenerPair,
} from '../../modules/consumers/dexscreener/v1/dexscreener.interfaces';

export enum EntitiesCacheKeyPrefix {
  DXSCR_PAIR = 'DXSCR_PAIR',
  DXSCR_LAST_PROC_BLOCK = 'DXSCR_LAST_PROC_BLOCK',
  DXSCR_BLOCK = 'DXSCR_BLOCK',
  DXSCR_ASSET = 'DXSCR_ASSET',
}

@Injectable()
export class DexScreenerCacheProvider extends BaseCacheClient {
  private readonly logger = new Logger(DexScreenerCacheProvider.name, { timestamp: true });

  constructor(appConfig: AppConfig) {
    super(appConfig, { cacheTtlMs: appConfig.ENTITIES_CACHE_TTL_MS });
  }

  /**
   * =========================================== B L O C K =========================================
   */
  async setBlock(id: string, entity: DexScreenerBlock) {
    try {
      await this.cache.set(`${EntitiesCacheKeyPrefix.DXSCR_BLOCK}_${id}`, entity);
    } catch (e) {}
  }
  async getBlock(id: string): Promise<DexScreenerBlock | undefined> {
    try {
      return this.cache.get(`${EntitiesCacheKeyPrefix.DXSCR_BLOCK}_${id}`);
    } catch (e) {}
    return;
  }

  /**
   * ======================= L A T E S T   P R O C E S S E D   B L O C K ===========================
   */
  async setLatestProcessedBlock(entity: DexScreenerBlock) {
    try {
      await this.cache.set(`${EntitiesCacheKeyPrefix.DXSCR_LAST_PROC_BLOCK}`, entity);
    } catch (e) {}
  }
  async getLatestProcessedBlock(): Promise<DexScreenerBlock | undefined> {
    try {
      return this.cache.get(`${EntitiesCacheKeyPrefix.DXSCR_LAST_PROC_BLOCK}`);
    } catch (e) {}
    return;
  }

  /**
   * =========================================== A S S E T =========================================
   */
  async setAsset(id: string, entity: DexScreenerAsset, ttlMs = 6000) {
    try {
      await this.cache.set(`${EntitiesCacheKeyPrefix.DXSCR_ASSET}_${id}`, entity, ttlMs);
    } catch (e) {}
  }
  async getAsset(id: string): Promise<DexScreenerAsset | undefined> {
    try {
      return this.cache.get(`${EntitiesCacheKeyPrefix.DXSCR_ASSET}_${id}`);
    } catch (e) {}
    return;
  }

  /**
   * =========================================== P A I R ===========================================
   */
  async setPair(id: string, entity: DexScreenerPair) {
    try {
      await this.cache.set(`${EntitiesCacheKeyPrefix.DXSCR_PAIR}_${id}`, entity);
    } catch (e) {}
  }
  async getPair(id: string): Promise<DexScreenerPair | undefined> {
    try {
      return this.cache.get(`${EntitiesCacheKeyPrefix.DXSCR_PAIR}_${id}`);
    } catch (e) {}
    return;
  }
}

export const DexScreenerCacheProviderFactory: Provider = {
  provide: DexScreenerCacheProviderToken,
  useClass: DexScreenerCacheProvider,
};

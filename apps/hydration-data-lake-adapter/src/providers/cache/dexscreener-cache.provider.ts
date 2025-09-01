import { Injectable, Logger, Provider } from '@nestjs/common';
import { AppConfig } from '../../modules/config';
import { DexScreenerCacheProviderToken } from '../index';
const Keyv = require('keyv');
import { BaseCacheClient } from './base-cache.helper';
import {
  DexScreenerBlock,
  DexScreenerPair,
} from '../../modules/consumers/dexscreener/v1/dexscreener.interfaces';

export enum EntitiesCacheKeyPrefix {
  DXSCR_PAIR = 'DXSCR_PAIR',
  DXSCR_BLOCK = 'DXSCR_BLOCK',
}

@Injectable()
export class DexScreenerCacheProvider extends BaseCacheClient {
  private readonly logger = new Logger(DexScreenerCacheProvider.name, { timestamp: true });

  constructor(appConfig: AppConfig) {
    super(appConfig, { cacheTtlMs: appConfig.ENTITIES_CACHE_TTL_MS });
  }

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
}

export const DexScreenerCacheProviderFactory: Provider = {
  provide: DexScreenerCacheProviderToken,
  useClass: DexScreenerCacheProvider,
};

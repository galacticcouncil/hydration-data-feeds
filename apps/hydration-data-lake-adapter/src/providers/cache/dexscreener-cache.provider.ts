import { Injectable, Logger, Provider } from '@nestjs/common';
import { AppConfig } from '../../modules/config';
import { DexScreenerCacheProviderToken } from '../index';
const Keyv = require('keyv');
import { BaseCacheClient } from './base-cache.helper';
import { DexScreenerPair } from '../../modules/consumers/dexscreener/v1/dexscreener.interfaces';

export enum EntitiesCacheKeyPrefix {
  DXSCR_PAIR = 'DXSCR_PAIR',
}

@Injectable()
export class DexScreenerCacheProvider extends BaseCacheClient {
  private readonly logger = new Logger(DexScreenerCacheProvider.name, { timestamp: true });

  constructor(appConfig: AppConfig) {
    super(appConfig, { cacheTtlMs: appConfig.ENTITIES_CACHE_TTL_MS });
  }

  async setPair(id: string, entity: DexScreenerPair) {
    await this.cache.set(`${EntitiesCacheKeyPrefix.DXSCR_PAIR}_${id}`, entity);
  }
  async getPair(id: string): Promise<DexScreenerPair | undefined> {
    return this.cache.get(`${EntitiesCacheKeyPrefix.DXSCR_PAIR}_${id}`);
  }
}

export const DexScreenerCacheProviderFactory: Provider = {
  provide: DexScreenerCacheProviderToken,
  useClass: DexScreenerCacheProvider,
};

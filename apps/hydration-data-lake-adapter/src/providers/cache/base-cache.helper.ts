const Keyv = require('keyv'); // IMPORTANT: don't use "import()" instead of "require()"
import { createCache, Cache } from 'cache-manager';
import { CacheableMemory } from 'cacheable';
import { AppConfig } from '../../modules/config';

export class BaseCacheClient {
  private cacheInstance: Cache;

  constructor(
    private appConfig: AppConfig,
    private customCacheConfig: { cacheTtlMs: number } = { cacheTtlMs: -1 }
  ) {
    this.cacheInstance = this.initCache();
  }

  private initCache() {
    let keyvClass = null;
    try {
      keyvClass = Keyv.default;
    } catch (error) {
      keyvClass = Keyv;
    }
    if (!keyvClass) throw new Error('Keyv not found');

    return createCache({
      ...(this.customCacheConfig.cacheTtlMs >= 0 ? { ttl: this.customCacheConfig.cacheTtlMs } : {}),
      stores: [
        new Keyv.default({
          store: new CacheableMemory({
            ...(this.customCacheConfig.cacheTtlMs >= 0
              ? { ttl: this.customCacheConfig.cacheTtlMs }
              : {}),
            lruSize: 5000,
          }),
        }),
      ],
    });
  }

  get cache() {
    if (!this.cacheInstance) this.cacheInstance = this.initCache();
    return this.cacheInstance;
  }
}

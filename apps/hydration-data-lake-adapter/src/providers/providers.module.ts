import { Global, Module } from '@nestjs/common';
import { GraphQlClientProviderFactory } from './graphql-client.provider';
import { DexScreenerCacheProviderFactory } from './cache/dexscreener-cache.provider';
import { MainIndexerCacheProviderFactory } from './cache/main-indexer-cache.provider';

@Global()
@Module({
  providers: [
    GraphQlClientProviderFactory,
    DexScreenerCacheProviderFactory,
    MainIndexerCacheProviderFactory,
  ],
  exports: [
    GraphQlClientProviderFactory,
    DexScreenerCacheProviderFactory,
    MainIndexerCacheProviderFactory,
  ],
})
export class ProvidersModule {}

import { Global, Module } from '@nestjs/common';
import { GraphQlClientProviderFactory } from './graphql-client.provider';
import { DexScreenerCacheProviderFactory } from './cache/dexscreener-cache.provider';

@Global()
@Module({
  providers: [GraphQlClientProviderFactory, DexScreenerCacheProviderFactory],
  exports: [GraphQlClientProviderFactory, DexScreenerCacheProviderFactory],
})
export class ProvidersModule {}

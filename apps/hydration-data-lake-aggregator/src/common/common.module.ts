import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { getRedisConfig } from '../config/redis.config';
import { StateManagerService } from './services/state-manager.service';
import { AssetRegistryService } from './services/asset-registry.service';
import { PriceFetcherService } from './services/price-fetcher.service';
import { GraphqlClientModule } from '../graphql-client/graphql-client.module';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: getRedisConfig,
    }),
    GraphqlClientModule,
  ],
  providers: [StateManagerService, AssetRegistryService, PriceFetcherService],
  exports: [CacheModule, StateManagerService, AssetRegistryService, PriceFetcherService],
})
export class CommonModule {}

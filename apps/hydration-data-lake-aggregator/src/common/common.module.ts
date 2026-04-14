import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRedisConfig } from '../config/redis.config';
import { IngestionCheckpoint } from '../database/entities/ingestion-checkpoint.entity';
import { GraphqlClientModule } from '../graphql-client/graphql-client.module';
import { AssetRegistryService } from './services/asset-registry.service';
import { PriceFetcherService } from './services/price-fetcher.service';
import { StateManagerService } from './services/state-manager.service';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: getRedisConfig,
    }),
    GraphqlClientModule,
    TypeOrmModule.forFeature([IngestionCheckpoint]),
  ],
  providers: [StateManagerService, AssetRegistryService, PriceFetcherService],
  exports: [CacheModule, StateManagerService, AssetRegistryService, PriceFetcherService],
})
export class CommonModule {}

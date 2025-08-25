import { Module } from '@nestjs/common';
import { DexScreenerV1Controller } from './dexscreener.controller';
import { DexScreenerTransformer } from './dexscreener.transformer';
import { DataSourceService } from '../../../dataSource/data-source.service';
import { DexscreenerResolver } from './dexscreener.resolver';
import { AssetMetadataService } from './asset-metadata.service';

@Module({
  imports: [],
  controllers: [DexScreenerV1Controller],
  providers: [DexScreenerTransformer, DexscreenerResolver, DataSourceService, AssetMetadataService],
  exports: [DexScreenerTransformer, AssetMetadataService],
})
export class DexScreenerV1Module {}

import { Module } from '@nestjs/common';
import { DexScreenerV1Controller } from './dexscreener.controller';
import { DexScreenerTransformer } from './dexscreener.transformer';
import { DataSourceService } from '../../../dataSource/data-source.service';
import { DexscreenerResolver } from './dexscreener.resolver';

@Module({
  imports: [],
  controllers: [DexScreenerV1Controller],
  providers: [DexScreenerTransformer, DexscreenerResolver, DataSourceService],
  exports: [DexScreenerTransformer],
})
export class DexScreenerV1Module {}

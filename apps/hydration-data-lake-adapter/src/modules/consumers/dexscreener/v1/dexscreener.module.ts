import { Module } from '@nestjs/common';
import { DexScreenerV1Controller } from './dexscreener.controller';
import { DexScreenerTransformer } from './dexscreener.transformer';
import { DexscreenerResolver } from './dexscreener.resolver';
import { DataSourceModule } from '../../../dataSource/data-source.module';

@Module({
  imports: [DataSourceModule],
  controllers: [DexScreenerV1Controller],
  providers: [DexScreenerTransformer, DexscreenerResolver],
  exports: [DexScreenerTransformer],
})
export class DexScreenerV1Module {}

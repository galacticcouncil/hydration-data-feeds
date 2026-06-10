import { Module } from '@nestjs/common';
import { DexScreenerV1Controller } from './dexscreener.controller';
import { DexScreenerTransformer } from './dexscreener.transformer';
import { DexscreenerResolver } from './dexscreener.resolver';
import { DataSourceModule } from '../../../dataSource/data-source.module';
import { DexScreenerEntitiesService } from '../../../entities/dexscreener-entities.service';
import { DexScreenerValidator } from './dexscreener.validator';

@Module({
  imports: [DataSourceModule],
  controllers: [DexScreenerV1Controller],
  providers: [
    DexScreenerTransformer,
    DexscreenerResolver,
    DexScreenerEntitiesService,
    DexScreenerValidator,
  ],
  exports: [DexScreenerTransformer],
})
export class DexScreenerV1Module {}

import { Module } from '@nestjs/common';
import { DexScreenerEntitiesService } from './dexscreener-entities.service';
import { DexScreenerValidator } from '../consumers/dexscreener/v1/dexscreener.validator';

@Module({
  imports: [],
  providers: [DexScreenerEntitiesService, DexScreenerValidator],
  exports: [DexScreenerEntitiesService],
})
export class EntitiesModule {}

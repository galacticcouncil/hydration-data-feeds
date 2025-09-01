import { Module } from '@nestjs/common';
import { DexScreenerEntitiesService } from './dexscreener-entities.service';

@Module({
  imports: [],
  providers: [DexScreenerEntitiesService],
  exports: [DexScreenerEntitiesService],
})
export class EntitiesModule {}

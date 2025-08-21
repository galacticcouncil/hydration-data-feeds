import { Module } from '@nestjs/common';
import { DexScreenerV1Module } from './dexscreener/v1/dexscreener.module';
import { ConsumerRegistryService } from './consumer-registry.service';

@Module({
  imports: [
    DexScreenerV1Module,
    
    // Future consumer modules can be added here
    // CoinGeckoV1Module,
    // DefiLlamaV1Module,
  ],
  providers: [ConsumerRegistryService],
  exports: [ConsumerRegistryService],
})
export class ConsumersModule {}

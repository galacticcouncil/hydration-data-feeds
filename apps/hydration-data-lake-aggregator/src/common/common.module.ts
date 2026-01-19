import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { getRedisConfig } from '../config/redis.config';
import { StateManagerService } from './services/state-manager.service';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: getRedisConfig,
    }),
  ],
  providers: [StateManagerService],
  exports: [CacheModule, StateManagerService],
})
export class CommonModule {}

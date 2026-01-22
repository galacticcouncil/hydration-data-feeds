import { ConfigService } from '@nestjs/config';
import { CacheModuleOptions } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import { AppConfig } from './app.config';

export const getRedisConfig = async (
  configService: ConfigService<AppConfig>,
): Promise<CacheModuleOptions> => {
  const redisConfig = configService.get('redis', { infer: true });

  if (!redisConfig) {
    throw new Error('Redis configuration is missing');
  }

  // Build Redis connection string
  const redisUrl = redisConfig.password
    ? `redis://:${redisConfig.password}@${redisConfig.host}:${redisConfig.port}`
    : `redis://${redisConfig.host}:${redisConfig.port}`;

  return {
    // @ts-ignore
    stores: [new KeyvRedis(redisUrl)],
    ttl: 0, // No expiration by default (for persistent state management)
    isGlobal: true,
  };
};

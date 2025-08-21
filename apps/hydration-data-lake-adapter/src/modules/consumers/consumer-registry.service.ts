import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConsumerType, ApiVersion, ConsumerConfig } from './types';

@Injectable()
export class ConsumerRegistryService {
  private readonly logger = new Logger(ConsumerRegistryService.name, { timestamp: true });
  private readonly consumers = new Map<string, ConsumerConfig>();

  constructor(private moduleRef: ModuleRef) {
    this.initializeConsumers();
  }

  private initializeConsumers() {
    // Register DEX Screener V1
    this.registerConsumer({
      type: ConsumerType.DEX_SCREENER,
      version: ApiVersion.V1,
      enabled: true,
      basePath: 'v1/dexscreener',
      description: 'DEX Screener API v1 - Implementation of DEX Screener Adapter specification',
    });

    // Future consumers can be registered here
    // this.registerConsumer({
    //   type: ConsumerType.COINGECKO,
    //   version: ApiVersion.V1,
    //   enabled: false,
    //   basePath: 'v1/coingecko',
    //   description: 'CoinGecko API v1 - Custom format for CoinGecko integration',
    // });

    this.logger.log(`Registered ${this.consumers.size} consumer configurations`);
  }

  private registerConsumer(config: ConsumerConfig) {
    const key = this.getConsumerKey(config.type, config.version);
    this.consumers.set(key, config);
    this.logger.log(`Registered consumer: ${key} - ${config.description}`);
  }

  private getConsumerKey(type: ConsumerType, version: ApiVersion): string {
    return `${type}:${version}`;
  }

  getConsumer(type: ConsumerType, version: ApiVersion): ConsumerConfig | undefined {
    const key = this.getConsumerKey(type, version);
    return this.consumers.get(key);
  }

  getAllConsumers(): ConsumerConfig[] {
    return Array.from(this.consumers.values());
  }

  getEnabledConsumers(): ConsumerConfig[] {
    return this.getAllConsumers().filter(consumer => consumer.enabled);
  }

  getConsumersByType(type: ConsumerType): ConsumerConfig[] {
    return this.getAllConsumers().filter(consumer => consumer.type === type);
  }

  getConsumersByVersion(version: ApiVersion): ConsumerConfig[] {
    return this.getAllConsumers().filter(consumer => consumer.version === version);
  }

  isConsumerEnabled(type: ConsumerType, version: ApiVersion): boolean {
    const consumer = this.getConsumer(type, version);
    return consumer?.enabled || false;
  }

  enableConsumer(type: ConsumerType, version: ApiVersion): boolean {
    const key = this.getConsumerKey(type, version);
    const consumer = this.consumers.get(key);
    
    if (consumer) {
      consumer.enabled = true;
      this.logger.log(`Enabled consumer: ${key}`);
      return true;
    }
    
    this.logger.warn(`Consumer not found: ${key}`);
    return false;
  }

  disableConsumer(type: ConsumerType, version: ApiVersion): boolean {
    const key = this.getConsumerKey(type, version);
    const consumer = this.consumers.get(key);
    
    if (consumer) {
      consumer.enabled = false;
      this.logger.log(`Disabled consumer: ${key}`);
      return true;
    }
    
    this.logger.warn(`Consumer not found: ${key}`);
    return false;
  }

  getConsumerSummary() {
    const summary = {
      total: this.consumers.size,
      enabled: this.getEnabledConsumers().length,
      disabled: this.getAllConsumers().filter(c => !c.enabled).length,
      byType: {} as Record<string, number>,
      byVersion: {} as Record<string, number>,
      consumers: this.getAllConsumers().map(consumer => ({
        type: consumer.type,
        version: consumer.version,
        enabled: consumer.enabled,
        basePath: consumer.basePath,
        description: consumer.description,
      })),
    };

    // Count by type
    for (const consumer of this.getAllConsumers()) {
      summary.byType[consumer.type] = (summary.byType[consumer.type] || 0) + 1;
      summary.byVersion[consumer.version] = (summary.byVersion[consumer.version] || 0) + 1;
    }

    return summary;
  }
}

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { GraphqlClientService } from '../../graphql-client/services/graphql-client.service';
import { GET_ALL_ASSETS_QUERY } from '../../graphql-client/queries/swaps.queries';
import { GetAllAssetsResponse } from '../../graphql-client/types/graphql-response.types';
import { AppConfig } from '../../config/app.config';

@Injectable()
export class AssetRegistryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AssetRegistryService.name);

  // In-memory cache (primary storage - no Redis needed since all assets loaded on startup)
  private assetCache: Map<string, number> = new Map();
  private underlyingAssetMap: Map<string, string> = new Map(); // aTokenId -> underlyingAssetId
  private cacheLastUpdated: Date | null = null;

  private readonly refreshInterval: number;

  constructor(
    private readonly graphqlClient: GraphqlClientService,
    private readonly configService: ConfigService<AppConfig>,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    const config = this.configService.get('assetRegistry', { infer: true });
    if (!config) {
      throw new Error('Asset registry configuration is missing');
    }
    this.refreshInterval = config.refreshIntervalSeconds * 1000;
  }

  /**
   * Initialize asset registry on module startup
   */
  async onModuleInit() {
    this.logger.log('Initializing asset registry...');
    await this.refreshAssetRegistry();

    const interval = setInterval(() => {
      this.refreshAssetRegistry().catch((err) =>
        this.logger.error('Failed to refresh asset registry', err.stack),
      );
    }, this.refreshInterval);
    this.schedulerRegistry.addInterval('asset-registry-refresh', interval);

    this.logger.log(
      `Asset registry initialized with ${this.assetCache.size} assets. Refresh interval: ${this.refreshInterval / 1000}s`,
    );
  }

  onModuleDestroy() {
    clearInterval(this.schedulerRegistry.getInterval('asset-registry-refresh'));
  }

  /**
   * Get the underlying asset ID for an aToken, or null if not an aToken
   */
  getUnderlyingAssetId(assetId: string): string | null {
    return this.underlyingAssetMap.get(assetId) ?? null;
  }

  /**
   * Get decimals for a single asset
   */
  async getDecimals(assetId: string): Promise<number | null> {
    if (this.assetCache.has(assetId)) {
      return this.assetCache.get(assetId)!;
    }

    this.logger.warn(`Asset ${assetId} not found in registry`);
    return null;
  }

  /**
   * Get decimals for multiple assets in a single operation
   */
  async getDecimalsBatch(assetIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();

    if (assetIds.length === 0) return result;

    assetIds.forEach((assetId) => {
      if (this.assetCache.has(assetId)) {
        result.set(assetId, this.assetCache.get(assetId)!);
      }
    });

    return result;
  }

  /**
   * Refresh asset registry from GraphQL
   */
  async refreshAssetRegistry(): Promise<void> {
    try {
      this.logger.log('Fetching assets from GraphQL...');

      const response =
        await this.graphqlClient.query<GetAllAssetsResponse>(
          GET_ALL_ASSETS_QUERY,
        );

      const assets = response.assets.nodes;
      this.logger.log(`Fetched ${assets.length} assets from GraphQL`);

      // Build new maps then swap atomically — avoids a window where assetCache is empty
      const newCache = new Map<string, number>();
      const newUnderlyingMap = new Map<string, string>();
      assets.forEach((asset) => {
        newCache.set(asset.id, asset.decimals);
        if (asset.underlyingAssetId) {
          newUnderlyingMap.set(asset.id, asset.underlyingAssetId);
        }
      });
      this.assetCache = newCache;
      this.underlyingAssetMap = newUnderlyingMap;
      this.cacheLastUpdated = new Date();

      this.logger.log(
        `Updated asset registry with ${this.assetCache.size} assets (${this.underlyingAssetMap.size} aTokens with underlying)`,
      );
    } catch (error) {
      this.logger.error('Failed to refresh asset registry', error.stack);
      throw error;
    }
  }

  /**
   * Get registry statistics for monitoring
   */
  async getStats(): Promise<{
    assetCount: number;
    aTokenCount: number;
    lastUpdated: Date | null;
  }> {
    return {
      assetCount: this.assetCache.size,
      aTokenCount: this.underlyingAssetMap.size,
      lastUpdated: this.cacheLastUpdated,
    };
  }
}

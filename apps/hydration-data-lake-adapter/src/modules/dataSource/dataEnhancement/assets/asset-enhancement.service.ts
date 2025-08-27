import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AssetEnhancementEntry, AssetEnhancementData } from './types';

@Injectable()
export class AssetEnhancementService implements OnModuleInit {
  private readonly logger = new Logger(AssetEnhancementService.name);
  private assetEnhancementMap: Map<string, AssetEnhancementData> = new Map();

  async onModuleInit() {
    await this.loadAssetEnhancementData();
  }

  private async loadAssetEnhancementData() {
    try {
      const assets: AssetEnhancementEntry[] = await import('./assets.json');

      // Create a map for fast lookup by asset ID
      assets.forEach(({ asset }) => {
        this.assetEnhancementMap.set(asset.id, asset);
      });
    } catch (error) {
      this.logger.error('Failed to load asset enhancement data:', error);
    }
  }

  getAssetEnhancement(assetId: string): AssetEnhancementData | undefined {
    return this.assetEnhancementMap.get(assetId);
  }

  hasAssetEnhancement(assetId: string): boolean {
    return this.assetEnhancementMap.has(assetId);
  }

  getAllAssetIds(): string[] {
    return Array.from(this.assetEnhancementMap.keys());
  }

  async reloadAssetEnhancementData() {
    this.assetEnhancementMap.clear();
    await this.loadAssetEnhancementData();
    this.logger.log('Asset enhancement data reloaded');
  }
}

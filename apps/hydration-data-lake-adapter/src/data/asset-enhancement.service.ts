import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AssetEnhancementEntry, AssetEnhancementData } from './types';

@Injectable()
export class AssetEnhancementService {
  private readonly logger = new Logger(AssetEnhancementService.name);
  private assetEnhancementMap: Map<string, AssetEnhancementData> = new Map();

  constructor() {
    this.loadAssetEnhancementData();
  }

  private loadAssetEnhancementData(): void {
    try {
      const assetsFilePath = join(process.cwd(), 'src/data/assets.json');
      const assetsData = readFileSync(assetsFilePath, 'utf8');
      const assets: AssetEnhancementEntry[] = JSON.parse(assetsData);

      // Create a map for fast lookup by asset ID
      assets.forEach(({ asset }) => {
        this.assetEnhancementMap.set(asset.id, asset);
      });

      this.logger.log(`Loaded ${assets.length} asset enhancement entries from ${assetsFilePath}`);
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

  reloadAssetEnhancementData(): void {
    this.assetEnhancementMap.clear();
    this.loadAssetEnhancementData();
    this.logger.log('Asset enhancement data reloaded');
  }
}

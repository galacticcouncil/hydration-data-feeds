import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';

export interface AssetMetadata {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  coinGeckoId?: string;
  coinMarketCapId?: string;
}

export interface AssetMetadataEntry {
  asset: AssetMetadata;
}

@Injectable()
export class AssetMetadataService {
  private readonly logger = new Logger(AssetMetadataService.name);
  private metadataMap: Map<string, AssetMetadata> = new Map();

  constructor() {
    this.loadMetadata();
  }

  private loadMetadata(): void {
    try {
      // Use a single, reliable path from project root
      const metadataPath = path.join(process.cwd(), 'src/data/asset-metadata.json');
      
      this.logger.debug(`Loading metadata from: ${metadataPath}`);
      const metadataContent = fs.readFileSync(metadataPath, 'utf8');
      const metadataEntries: AssetMetadataEntry[] = JSON.parse(metadataContent);

      // Build a map for quick lookups by asset ID
      for (const entry of metadataEntries) {
        this.metadataMap.set(entry.asset.id, entry.asset);
      }

      this.logger.log(`Loaded ${this.metadataMap.size} asset metadata entries`);
    } catch (error) {
      this.logger.error('Failed to load asset metadata:', error.message);
      // Continue with empty metadata map - the service should be fault-tolerant
    }
  }

  /**
   * Get metadata for a specific asset ID
   */
  getMetadataById(assetId: string): AssetMetadata | null {
    return this.metadataMap.get(assetId) || null;
  }

  /**
   * Get all available metadata
   */
  getAllMetadata(): AssetMetadata[] {
    return Array.from(this.metadataMap.values());
  }

  /**
   * Check if metadata exists for an asset ID
   */
  hasMetadata(assetId: string): boolean {
    return this.metadataMap.has(assetId);
  }

  /**
   * Get the total number of metadata entries
   */
  getMetadataCount(): number {
    return this.metadataMap.size;
  }
}

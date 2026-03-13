import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DatasetMetadataDto } from './dto/dataset-metadata.dto';
import { AppConfig } from '../config/app.config';

@Injectable()
export class DatasetService {
  private readonly logger = new Logger(DatasetService.name);
  private coverageCache: {
    timeBounds: { minTime: string; maxTime: string };
    blockBounds: { minBlockHeight: number; maxBlockHeight: number };
  } | null = null;
  private lastCacheUpdate: Date | null = null;
  private coveragePromise: Promise<NonNullable<typeof this.coverageCache>> | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
    private configService: ConfigService<AppConfig>,
  ) {}

  async getMetadata(): Promise<DatasetMetadataDto> {
    this.logger.log('Fetching dataset metadata');

    // Get coverage (cached or fresh)
    const coverage = await this.getCoverage();

    return {
      metadataVersion: 1,
      dataset: {
        id: this.configService.get('dataset.id', { infer: true })!,
        version: this.configService.get('dataset.version', { infer: true })!,
        network: this.configService.get('dataset.network', { infer: true })!,
      },
      indexer: {
        id: this.configService.get('indexer.id', { infer: true })!,
        version: this.configService.get('indexer.version', { infer: true })!,
        network: this.configService.get('indexer.network', { infer: true })!,
      },
      coverage,
    };
  }

  private async getCoverage() {
    if (this.isCacheValid()) {
      this.logger.debug('Using cached coverage data');
      return this.coverageCache!;
    }

    // Reuse in-flight request to prevent cache stampede under concurrent calls
    if (!this.coveragePromise) {
      this.coveragePromise = this.fetchCoverage().finally(() => {
        this.coveragePromise = null;
      });
    }

    return this.coveragePromise;
  }

  private async fetchCoverage() {
    this.logger.log('Fetching fresh coverage data from database');

    // Get time bounds from continuous aggregate (fast) and block bounds from raw table
    // We use swaps_raw for block height as it's the primary data source
    const result = await this.dataSource.query(`
      SELECT
        (SELECT MIN(bucket) FROM fees_1hour) as min_time,
        (SELECT MAX(bucket) FROM fees_1hour) as max_time,
        (SELECT MIN(block_height) FROM swaps_raw) as min_block,
        (SELECT MAX(block_height) FROM swaps_raw) as max_block
    `);

    this.coverageCache = {
      timeBounds: {
        minTime: result[0]?.min_time || new Date().toISOString(),
        maxTime: result[0]?.max_time || new Date().toISOString(),
      },
      blockBounds: {
        minBlockHeight: parseInt(result[0]?.min_block || '0'),
        maxBlockHeight: parseInt(result[0]?.max_block || '0'),
      },
    };

    this.lastCacheUpdate = new Date();
    this.logger.log(`Coverage data cached: ${JSON.stringify(this.coverageCache)}`);

    return this.coverageCache!;
  }

  private isCacheValid(): boolean {
    if (!this.coverageCache || !this.lastCacheUpdate) {
      return false;
    }

    const now = new Date();
    const cacheAge = now.getTime() - this.lastCacheUpdate.getTime();
    return cacheAge < this.CACHE_TTL_MS;
  }

  /**
   * Manually invalidate cache (useful for testing or after data updates)
   */
  invalidateCache(): void {
    this.logger.log('Coverage cache invalidated');
    this.coverageCache = null;
    this.lastCacheUpdate = null;
  }
}

import type { Cache } from 'cache-manager';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IngestionCheckpoint } from '../../database/entities/ingestion-checkpoint.entity';

export interface IngestionState {
  lastProcessedBlock?: number; // Optional: only used for sequential block processing (e.g., ingestion)
  lastProcessedTimestamp: string;
  lastIngestionAt: string;
  status: 'running' | 'paused' | 'error' | 'initialized';
  errorMessage?: string;
}

/**
 * Redis-based state manager for tracking service state
 * Used by both sequential processors (ingestion) and database-driven processors (enrichment)
 * Each service tracks its own state independently
 */
@Injectable()
export class StateManagerService {
  private readonly logger = new Logger(StateManagerService.name);
  private readonly KEY_PREFIX = 'ingestion:state:';

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectRepository(IngestionCheckpoint)
    private readonly checkpointRepository: Repository<IngestionCheckpoint>,
  ) {}

  /**
   * Get ingestion state for a specific service
   * @param serviceName - e.g., 'swaps', 'money-market', 'lending'
   */
  async getState(serviceName: string): Promise<IngestionState | null> {
    try {
      const key = this.getKey(serviceName);
      const state = await this.cacheManager.get<IngestionState>(key);

      if (!state) {
        this.logger.debug(`No state found for service: ${serviceName}`);
        return null;
      }

      return state;
    } catch (error) {
      this.logger.error(
        `Failed to get state for ${serviceName}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Set ingestion state for a specific service
   */
  async setState(
    serviceName: string,
    state: IngestionState,
  ): Promise<void> {
    try {
      const key = this.getKey(serviceName);

      await this.cacheManager.set(key, state);

      this.logger.debug(
        `Updated state for ${serviceName}: block ${state.lastProcessedBlock}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to set state for ${serviceName}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update only the last processed block.
   * Also persists a DB checkpoint so the block survives a Redis flush.
   */
  async updateLastBlock(
    serviceName: string,
    blockNumber: number,
  ): Promise<void> {
    const currentState = await this.getState(serviceName);

    const newState: IngestionState = {
      ...(currentState ?? {}),
      lastProcessedBlock: blockNumber,
      lastProcessedTimestamp: new Date().toISOString(),
      lastIngestionAt: new Date().toISOString(),
      status: 'running',
    };

    await this.setState(serviceName, newState);

    // Persist to DB — fire-and-forget so a DB hiccup never blocks ingestion
    this.persistCheckpoint(serviceName, blockNumber).catch((err) =>
      this.logger.warn(`DB checkpoint write failed for ${serviceName}: ${err.message}`),
    );
  }

  /**
   * Initialize state for a new service
   */
  async initializeState(
    serviceName: string,
    startBlock: number,
  ): Promise<void> {
    const existingState = await this.getState(serviceName);

    if (existingState) {
      this.logger.log(
        `State already exists for ${serviceName}, skipping initialization`,
      );
      return;
    }

    const initialState: IngestionState = {
      lastProcessedBlock: startBlock - 1,
      lastProcessedTimestamp: new Date().toISOString(),
      lastIngestionAt: new Date().toISOString(),
      status: 'initialized',
    };

    await this.setState(serviceName, initialState);

    this.logger.log(
      `Initialized state for ${serviceName} at block ${startBlock - 1}`,
    );
  }

  /**
   * Mark service as errored
   */
  async setError(serviceName: string, errorMessage: string): Promise<void> {
    const currentState = await this.getState(serviceName);

    const errorState: IngestionState = {
      ...(currentState ?? {}),
      lastProcessedTimestamp: new Date().toISOString(),
      lastIngestionAt: new Date().toISOString(),
      status: 'error',
      errorMessage,
    };

    await this.setState(serviceName, errorState);
  }

  /**
   * Get last processed block for a service
   */
  async getLastProcessedBlock(serviceName: string): Promise<number | null> {
    const state = await this.getState(serviceName);
    return state?.lastProcessedBlock ?? null;
  }

  /**
   * Returns the last processed block from Redis, falling back to the DB
   * checkpoint when Redis is unavailable, and finally to defaultBlock.
   */
  async getLastProcessedBlockOrDefault(
    serviceName: string,
    defaultBlock: number,
  ): Promise<number> {
    const lastBlock = await this.getLastProcessedBlock(serviceName);
    if (lastBlock !== null) return lastBlock;

    // Redis miss — try the DB checkpoint before resetting to genesis
    try {
      const checkpoint = await this.checkpointRepository.findOne({
        where: { serviceName },
      });
      if (checkpoint) {
        this.logger.warn(
          `Redis state missing for ${serviceName} — resuming from DB checkpoint at block ${checkpoint.lastBlock}`,
        );
        return checkpoint.lastBlock;
      }
    } catch (err) {
      this.logger.error(
        `DB checkpoint fallback failed for ${serviceName}: ${err.message}`,
      );
    }

    return defaultBlock;
  }

  /**
   * Get statistics for all services
   */
  async getAllServicesStats(): Promise<Map<string, IngestionState>> {
    const knownServices = ['swaps', 'money-market', 'pepl-liquidation-profit', 'asset-reserve', 'hsm-revenue', 'borrow-apr'];
    const stats = new Map<string, IngestionState>();

    for (const service of knownServices) {
      const state = await this.getState(service);
      if (state) {
        stats.set(service, state);
      }
    }

    return stats;
  }

  /**
   * Delete state for a service (for testing/reset)
   */
  async deleteState(serviceName: string): Promise<void> {
    try {
      const key = this.getKey(serviceName);
      await this.cacheManager.del(key);

      this.logger.log(`Deleted state for ${serviceName}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete state for ${serviceName}`,
        error.stack,
      );
    }
  }

  /**
   * Generate Redis key for service state
   */
  private getKey(serviceName: string): string {
    return `${this.KEY_PREFIX}${serviceName}`;
  }

  private async persistCheckpoint(serviceName: string, lastBlock: number): Promise<void> {
    await this.checkpointRepository.upsert(
      { serviceName, lastBlock, updatedAt: new Date() },
      ['serviceName'],
    );
  }
}

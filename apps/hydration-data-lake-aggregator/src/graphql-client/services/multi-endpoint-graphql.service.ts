import type { RequestDocument } from 'graphql-request';
import {
  GraphQLClient,
  Variables,
} from 'graphql-request';

import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { getMultiEndpointConfig } from '../config/endpoint.config';
import { MultiEndpointConfig } from '../types/endpoint.types';
import {
  findEndpointsForBlockRange,
  getHeadEndpoint,
} from '../utils/block-range.utils';
import { QueryAnalyzerService } from './query-analyzer.service';
import { ResultMergerService } from './result-merger.service';

/**
 * Multi-endpoint GraphQL client service that automatically routes queries
 * to different endpoints based on block ranges, splits queries spanning
 * multiple endpoints, and merges results
 */
@Injectable()
export class MultiEndpointGraphqlService {
  private readonly logger = new Logger(MultiEndpointGraphqlService.name);
  private config: MultiEndpointConfig;
  private clients: Map<string, GraphQLClient> = new Map();

  // Configuration for retry logic (matches single-endpoint client)
  private readonly retries = 3;
  private readonly retryDelay = 1000; // 1 second

  constructor(
    private configService: ConfigService,
    private queryAnalyzer: QueryAnalyzerService,
    private resultMerger: ResultMergerService,
  ) {
    this.config = getMultiEndpointConfig(this.configService);

    if (this.config.enabled) {
      for (const endpoint of this.config.endpoints) {
        const client = new GraphQLClient(endpoint.apiUrl);
        this.clients.set(endpoint.apiUrl, client);
      }

      // Also create a client for the fallback (squid) URL — used for queries
      // that have no block range (e.g. GetAllAssets) which reaper doesn't serve
      if (this.config.fallbackUrl && !this.clients.has(this.config.fallbackUrl)) {
        this.clients.set(this.config.fallbackUrl, new GraphQLClient(this.config.fallbackUrl));
      }

      this.logger.log(
        `Multi-endpoint mode initialized with ${this.config.endpoints.length} endpoints`,
      );
    } else {
      const client = new GraphQLClient(this.config.fallbackUrl);
      this.clients.set(this.config.fallbackUrl, client);

      this.logger.log(
        `Single-endpoint mode initialized: ${this.config.fallbackUrl}`,
      );
    }
  }

  /**
   * Execute a GraphQL query with automatic endpoint routing and query splitting
   *
   * @param query - GraphQL query document
   * @param variables - Query variables
   * @returns Query result
   */
  async query<T = any, V extends Variables = Variables>(
    query: RequestDocument,
    variables?: V,
  ): Promise<T> {
    // If multi-endpoint mode is disabled, use legacy single endpoint
    if (!this.config.enabled) {
      return this.querySingleEndpoint(
        this.config.fallbackUrl,
        query,
        variables,
      );
    }

    // Extract block range from variables
    const blockRange = this.queryAnalyzer.extractBlockRange(variables || {});

    // If no block range found, use the fallback (squid) URL — reaper endpoints
    // only serve block-range-scoped queries, not general ones like GetAllAssets
    if (!blockRange) {
      this.logger.debug(
        `No block range found in variables, querying fallback endpoint: ${this.config.fallbackUrl}`,
      );
      return this.querySingleEndpoint(this.config.fallbackUrl, query, variables);
    }

    // Find endpoints that cover the requested block range
    try {
      const assignments = findEndpointsForBlockRange(
        this.config.endpoints,
        blockRange,
      );

      // Single endpoint - direct query
      if (assignments.length === 1) {
        const assignment = assignments[0];
        this.logger.debug(
          `Querying single endpoint ${assignment.endpoint.apiUrl} for blocks ${assignment.blockRange.fromBlock}-${assignment.blockRange.toBlock}`,
        );
        return this.querySingleEndpoint(
          assignment.endpoint.apiUrl,
          query,
          variables,
        );
      }

      // Multiple endpoints - split query and merge results
      this.logger.log(
        `Splitting query across ${assignments.length} endpoints for block range ${blockRange.fromBlock}-${blockRange.toBlock}`,
      );

      const results = await Promise.all(
        assignments.map((assignment) => {
          const updatedVariables = this.queryAnalyzer.updateBlockRangeVariables(
            variables || {},
            assignment.blockRange,
          );

          this.logger.debug(
            `Querying endpoint ${assignment.endpoint.apiUrl} for blocks ${assignment.blockRange.fromBlock}-${assignment.blockRange.toBlock}`,
          );

          return this.querySingleEndpoint(
            assignment.endpoint.apiUrl,
            query,
            updatedVariables as V,
          );
        }),
      );

      // Merge results
      const merged = this.resultMerger.mergeResults<T>(results);
      this.logger.log(
        `Successfully merged results from ${assignments.length} endpoints`,
      );

      return merged;
    } catch (error) {
      this.logger.error(
        `Multi-endpoint query failed for block range ${blockRange.fromBlock}-${blockRange.toBlock}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Query a single endpoint with retry logic
   *
   * @param endpointUrl - Endpoint URL to query
   * @param query - GraphQL query document
   * @param variables - Query variables
   * @returns Query result
   */
  private async querySingleEndpoint<T = any, V extends Variables = Variables>(
    endpointUrl: string,
    query: RequestDocument,
    variables?: V,
  ): Promise<T> {
    const client = this.clients.get(endpointUrl);
    if (!client) {
      throw new Error(`No client found for endpoint: ${endpointUrl}`);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        if (attempt > 0) {
          this.logger.debug(
            `Retry attempt ${attempt}/${this.retries} for endpoint ${endpointUrl}`,
          );
          // Exponential backoff
          await this.sleep(this.retryDelay * Math.pow(2, attempt - 1));
        }

        // console.log(`[MultiEndpointGraphql] Request -> ${endpointUrl}`, { variables });
        const result = await client.request<T>(query, variables as any);
        return result;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Query failed for endpoint ${endpointUrl} (attempt ${attempt + 1}/${this.retries + 1}): ${error.message}`,
        );

        // Don't retry on last attempt
        if (attempt === this.retries) {
          break;
        }
      }
    }

    const errorMessage = `Endpoint ${endpointUrl} failed after ${this.retries + 1} attempts: ${lastError?.message}`;
    this.logger.error(errorMessage, lastError?.stack);
    throw new Error(errorMessage);
  }

  /**
   * Get the current block height from the head endpoint
   *
   * @returns Current block height
   */
  async getCurrentBlockHeight(): Promise<number> {
    const query = `
      query GetCurrentBlock {
        swaps(
          orderBy: PARA_BLOCK_HEIGHT_DESC
          first: 1
        ) {
          nodes {
            paraBlockHeight
          }
        }
      }
    `;

    try {
      // Query the head endpoint
      const headEndpoint = this.config.enabled
        ? getHeadEndpoint(this.config.endpoints)
        : { apiUrl: this.config.fallbackUrl };

      this.logger.debug(
        `Getting current block height from ${headEndpoint.apiUrl}`,
      );

      const result = await this.querySingleEndpoint<{
        swaps: {
          nodes: Array<{ paraBlockHeight: number }>;
        };
      }>(headEndpoint.apiUrl, query);

      if (!result.swaps.nodes.length) {
        this.logger.warn('No swaps found, using default block height');
        return 10000000; // Default fallback
      }

      return result.swaps.nodes[0].paraBlockHeight;
    } catch (error) {
      this.logger.error('Failed to get current block height', error.stack);
      throw error;
    }
  }

  /**
   * Get the multi-endpoint configuration (for debugging/monitoring)
   *
   * @returns Current configuration
   */
  getConfig(): MultiEndpointConfig {
    return this.config;
  }

  /**
   * Check if multi-endpoint mode is enabled
   *
   * @returns true if multi-endpoint mode is enabled
   */
  isMultiEndpointEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Sleep utility for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

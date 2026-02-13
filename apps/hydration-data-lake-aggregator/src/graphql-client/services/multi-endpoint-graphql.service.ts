import type { RequestDocument } from 'graphql-request';
import { GraphQLClient, Variables } from 'graphql-request';

import { Injectable, Logger } from '@nestjs/common';
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

    const enforcedUrls: { hsmBalances: string | null } = this.configService.get(
      'graphql.enforcedEndpoints',
    ) || { hsmBalances: null };

    for (const key in enforcedUrls) {
      if (enforcedUrls[key]) {
        this.clients.set(
          enforcedUrls[key],
          new GraphQLClient(enforcedUrls[key]),
        );
      }
    }

    if (this.config.enabled) {
      for (const endpoint of this.config.endpoints) {
        const client = new GraphQLClient(endpoint.apiUrl);
        this.clients.set(endpoint.apiUrl, client);
      }

      // Also create a client for the fallback (squid) URL — used for queries
      // that have no block range (e.g. GetAllAssets) which reaper doesn't serve
      if (
        this.config.fallbackUrl &&
        !this.clients.has(this.config.fallbackUrl)
      ) {
        this.clients.set(
          this.config.fallbackUrl,
          new GraphQLClient(this.config.fallbackUrl),
        );
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
   * @param options - Optional configuration for query execution
   * @param options.targetUrl - Override URL to query specific endpoint (bypasses routing)
   * @returns Query result
   */
  async query<T = any, V extends Variables = Variables>(
    query: RequestDocument,
    variables?: V,
    options?: { targetUrl?: string },
  ): Promise<T> {
    // If targetUrl is explicitly provided, bypass all routing and query that endpoint
    if (options?.targetUrl) {
      this.logger.debug(
        `Querying specific endpoint via override: ${options.targetUrl}`,
      );
      return this.querySingleEndpoint(options.targetUrl, query, variables);
    }

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
      return this.querySingleEndpoint(
        this.config.fallbackUrl,
        query,
        variables,
      );
    }

    // Find endpoints that cover the requested block range
    try {
      const assignments = findEndpointsForBlockRange(
        this.config.endpoints,
        blockRange,
      );

      this.logger.debug(
        `[Router] Query with variables ${JSON.stringify(variables)} → Detected block range [${blockRange.fromBlock}, ${blockRange.toBlock}] → Routing to ${assignments.length} endpoint(s)`,
      );

      // Single endpoint - direct query
      if (assignments.length === 1) {
        const assignment = assignments[0];
        this.logger.debug(
          `[Router] Querying single endpoint ${assignment.endpoint.apiUrl} (covers ${assignment.endpoint.fromBlockHeight}-${assignment.endpoint.toBlockHeight}) for blocks ${assignment.blockRange.fromBlock}-${assignment.blockRange.toBlock}`,
        );
        return this.querySingleEndpoint(
          assignment.endpoint.apiUrl,
          query,
          variables,
        );
      }

      // Multiple endpoints - split query and merge results
      this.logger.log(
        `[Router] Splitting query across ${assignments.length} endpoints for block range ${blockRange.fromBlock}-${blockRange.toBlock}`,
      );

      const results = await Promise.all(
        assignments.map(async (assignment) => {
          const updatedVariables = this.queryAnalyzer.updateBlockRangeVariables(
            variables || {},
            assignment.blockRange,
          );

          this.logger.debug(
            `[Router] Querying endpoint ${assignment.endpoint.apiUrl} (covers ${assignment.endpoint.fromBlockHeight}-${assignment.endpoint.toBlockHeight}) for blocks ${assignment.blockRange.fromBlock}-${assignment.blockRange.toBlock} with variables ${JSON.stringify(updatedVariables)}`,
          );

          const result = await this.querySingleEndpoint(
            assignment.endpoint.apiUrl,
            query,
            updatedVariables as V,
          );

          // Log what this endpoint returned
          const resultInfo = this.getResultInfo(result);
          this.logger.debug(
            `[Router] Endpoint ${assignment.endpoint.apiUrl} returned ${resultInfo}`,
          );

          return result;
        }),
      );

      // Detect sort order from the GraphQL query AST
      const sortOrder = this.detectSortOrder(query);

      // Merge results with appropriate sort order
      const merged = this.resultMerger.mergeResults<T>(results, sortOrder);
      this.logger.log(
        `Successfully merged results from ${assignments.length} endpoints (sort: ${sortOrder})`,
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
   * Helper to extract useful info from query result for logging
   */
  private getResultInfo(result: any): string {
    if (!result) return '0 results';

    // Handle different response structures
    for (const key of Object.keys(result)) {
      const value = result[key];
      if (value && typeof value === 'object') {
        if ('nodes' in value && Array.isArray(value.nodes)) {
          return `${value.nodes.length} nodes`;
        }
        if (Array.isArray(value)) {
          return `${value.length} items`;
        }
      }
    }
    return 'unknown result structure';
  }

  /**
   * Query a single endpoint with retry logic
   * Made public to allow direct endpoint queries (bypassing multi-endpoint routing)
   * for scenarios like historical fallback queries in HSM revenue ingestion
   *
   * @param endpointUrl - Endpoint URL to query
   * @param query - GraphQL query document
   * @param variables - Query variables
   * @returns Query result
   */
  public async querySingleEndpoint<T = any, V extends Variables = Variables>(
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
   * Detect sort order from GraphQL query document
   * Analyzes the query AST to find orderBy directives and determine if DESC is used
   *
   * @param query - GraphQL query document
   * @returns 'asc', 'desc', or 'none'
   */
  private detectSortOrder(query: RequestDocument): 'asc' | 'desc' | 'none' {
    try {
      // Convert query to string if it's a DocumentNode
      let queryString: string;
      if (typeof query === 'string') {
        queryString = query;
      } else if (query && typeof query === 'object' && 'loc' in query) {
        // It's a DocumentNode from graphql-tag
        queryString = query.loc?.source.body || '';
      } else {
        return 'asc'; // Default to ascending if we can't parse
      }

      // Look for orderBy pattern in the query string
      // Patterns: orderBy: PARA_BLOCK_HEIGHT_DESC or orderBy: [PARA_BLOCK_HEIGHT_DESC, ...]
      const orderByDescPattern = /_DESC/;
      const orderByAscPattern = /_ASC/;

      if (orderByDescPattern.test(queryString)) {
        return 'desc';
      } else if (orderByAscPattern.test(queryString)) {
        return 'asc';
      }

      // No explicit ordering found, default to ascending
      return 'asc';
    } catch (error) {
      this.logger.warn(
        `Failed to detect sort order from query: ${error.message}`,
      );
      return 'asc'; // Safe default
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
   * Get the head endpoint URL (most recent data)
   * Useful for queries that should always target the latest endpoint
   *
   * @returns URL of the head endpoint
   */
  getHeadEndpointUrl(): string {
    if (!this.config.enabled) {
      return this.config.fallbackUrl;
    }
    const headEndpoint = getHeadEndpoint(this.config.endpoints);
    return headEndpoint.apiUrl;
  }

  /**
   * Get a specific endpoint URL by block height
   * Useful for targeting queries to specific historical endpoints
   *
   * @param blockHeight - Block height to find endpoint for
   * @returns URL of the endpoint covering that block, or fallback URL if not found
   */
  getEndpointUrlForBlock(blockHeight: number): string {
    if (!this.config.enabled) {
      return this.config.fallbackUrl;
    }

    const endpoint = this.config.endpoints.find(
      (ep) =>
        ep.fromBlockHeight <= blockHeight &&
        (ep.toBlockHeight >= blockHeight || ep.isHeadEndpoint),
    );

    return endpoint ? endpoint.apiUrl : this.config.fallbackUrl;
  }

  /**
   * Sleep utility for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

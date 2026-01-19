import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLClient, Variables } from 'graphql-request';
import type { RequestDocument } from 'graphql-request';
import { AppConfig } from '../config/app.config';
import { getGraphQLClientConfig } from '../config/graphql-client.config';

@Injectable()
export class GraphqlClientService {
  private readonly logger = new Logger(GraphqlClientService.name);
  private client: GraphQLClient;
  private config: ReturnType<typeof getGraphQLClientConfig>;

  constructor(private configService: ConfigService<AppConfig>) {
    this.config = getGraphQLClientConfig(this.configService);
    this.client = new GraphQLClient(this.config.endpoint);

    this.logger.log(`GraphQL client initialized for ${this.config.endpoint}`);
  }

  /**
   * Execute a GraphQL query with automatic retry logic
   */
  async query<T = any, V extends Variables = Variables>(
    query: RequestDocument,
    variables?: V,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        if (attempt > 0) {
          this.logger.debug(
            `Retry attempt ${attempt}/${this.config.retries} for GraphQL query`,
          );
          // Exponential backoff
          await this.sleep(this.config.retryDelay * Math.pow(2, attempt - 1));
        }

        const result = await this.client.request<T>(query, variables as any);
        return result;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `GraphQL query failed (attempt ${attempt + 1}/${this.config.retries + 1}): ${error.message}`,
        );

        // Don't retry on last attempt
        if (attempt === this.config.retries) {
          break;
        }
      }
    }

    this.logger.error(
      `GraphQL query failed after ${this.config.retries + 1} attempts`,
      lastError?.stack,
    );
    throw lastError || new Error('GraphQL query failed');
  }

  /**
   * Get the current block height from the GraphQL endpoint
   * Fetches the latest swap to determine the current indexed block
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
      const result = await this.query<{
        swaps: {
          nodes: Array<{ paraBlockHeight: number }>;
        };
      }>(query);

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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

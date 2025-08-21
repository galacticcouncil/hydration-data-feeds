import {
  AnyVariables,
  cacheExchange,
  Client as GqlClient,
  DocumentInput,
  Exchange,
  fetchExchange,
} from '@urql/core';
import { map, pipe } from 'wonka';
import { Injectable, Logger, Provider } from '@nestjs/common';
import { ApiEndpoint, PaginationConfig } from '../modules/dataSource/types';
import { AppConfig } from '../modules/config';
import { retryExchange } from '@urql/exchange-retry';
import { GraphQlClientProviderToken } from './index';

const responsePreprocessingExchange: Exchange =
  ({ forward }) =>
  (ops$) => {
    return pipe(
      forward(ops$),
      map((result) => {
        if (result.error) {
          console.log((result.operation.context.fetchOptions as RequestInit)?.headers);
          console.error(
            `GraphQL API [${(result.operation.context.fetchOptions as RequestInit)?.headers?.['ApiEndpoint']}] Error:`,
            result.error.message
          );
        }
        return result;
      })
    );
  };

@Injectable()
export class GraphqlClientProvider {
  private readonly logger = new Logger(GraphqlClientProvider.name, { timestamp: true });
  private gqlClientUrlsMap: Map<ApiEndpoint, string>;
  private gqlClients: Map<ApiEndpoint, GqlClient> = new Map();

  constructor(private appConfig: AppConfig) {
    // Initialize URL mapping for different GraphQL endpoints
    this.gqlClientUrlsMap = new Map([
      [ApiEndpoint.MAIN_INDEXER_API, this.appConfig.graphql.MAIN_INDEXER_GRAPHQL_ENDPOINT],
      // [ApiEndpoint.HISTORICAL_DATA, this.appConfig.graphql.getEndpointUrl('HISTORICAL')],
    ]);

    this.logger.log(
      'QueriesHelper initialized with endpoints:',
      Array.from(this.gqlClientUrlsMap.entries())
    );
  }

  getGqlClient(endpoint: ApiEndpoint): GqlClient {
    if (this.gqlClients.has(endpoint) && !!this.gqlClients.get(endpoint)) {
      return this.gqlClients.get(endpoint)!;
    }

    const url = this.gqlClientUrlsMap.get(endpoint);
    if (!url) {
      throw new Error(`No URL configured for endpoint: ${endpoint}`);
    }

    const retryOptions = {
      initialDelayMs: this.appConfig.graphql.GRAPHQL_RETRY_DELAY_MS,
      maxDelayMs: this.appConfig.graphql.GRAPHQL_MAX_RETRY_DELAY_MS,
      randomDelay: true,
      maxNumberAttempts: this.appConfig.graphql.GRAPHQL_MAX_RETRY_ATTEMPTS,
      retryIf: (err: any) => err && (err.networkError || err.response?.status >= 500),
    };

    const headers: Record<string, string> = {
      ApiEndpoint: endpoint,
    };

    const client = new GqlClient({
      url,
      fetchOptions: {
        headers,
      },
      exchanges: [
        // cacheExchange,
        retryExchange(retryOptions),
        responsePreprocessingExchange,
        fetchExchange,
      ],
      preferGetMethod: false,
    });

    this.gqlClients.set(endpoint, client);
    this.logger.log(`Created GraphQL client for endpoint: ${endpoint} -> ${url}`);
    return client;
  }

  async gqlRequest<Data = any, Variables extends AnyVariables = AnyVariables>({
    query,
    variables,
    endpoint = ApiEndpoint.MAIN_INDEXER_API,
  }: {
    query: DocumentInput<Data, Variables>;
    variables?: Variables;
    endpoint?: ApiEndpoint;
  }): Promise<{ data?: Data; error?: any }> {
    try {
      const result = await this.getGqlClient(endpoint).query(query, variables || ({} as Variables));

      if (result.error) {
        this.logger.error(`GraphQL query failed for endpoint ${endpoint}:`, result.error);
        return { error: result.error };
      }

      return { data: result.data };
    } catch (error) {
      this.logger.error(`GraphQL request failed for endpoint ${endpoint}:`, error);
      return { error };
    }
  }

  async *fetchAllPages<R = any[]>({
    requestPromise,
    limit,
    endpoint,
  }: {
    requestPromise: (args: {
      pageSize: number;
      offset: number;
      endpoint: ApiEndpoint;
    }) => Promise<{ totalCount: number; data: R }>;
    limit: number;
    endpoint: ApiEndpoint;
  }): AsyncGenerator<R, void, unknown> {
    const pageSize = limit;
    let offset = 0;
    let totalCount = Infinity; // Set to a high number initially to enter the loop

    while (offset < totalCount) {
      try {
        const responseWithTotal = await requestPromise({
          pageSize,
          offset,
          endpoint,
        });

        yield responseWithTotal.data;

        totalCount = responseWithTotal.totalCount;
        offset += pageSize;

        this.logger.debug(
          `Fetched page: offset=${offset - pageSize}, pageSize=${pageSize}, totalCount=${totalCount}`
        );
      } catch (error) {
        this.logger.error(`Error fetching page at offset ${offset}:`, error);
        break;
      }
    }
  }

  getGenericFilterParams<T>(filtersSrc: Map<number, { blockNumber: number; ids: Set<T> }>): {
    ids: T[];
    fromBlockNumber: number;
    toBlockNumber: number;
  } {
    const resp: { ids: T[]; fromBlockNumber: number; toBlockNumber: number } = {
      ids: [],
      fromBlockNumber: 0,
      toBlockNumber: 0,
    };

    filtersSrc.forEach((blockScope, blockNumber) => {
      resp.ids.push(...blockScope.ids.values());

      if (
        resp.fromBlockNumber === 0 ||
        (resp.fromBlockNumber !== 0 && blockNumber < resp.fromBlockNumber)
      ) {
        resp.fromBlockNumber = blockNumber;
      }

      if (
        resp.toBlockNumber === 0 ||
        (resp.toBlockNumber !== 0 && blockNumber > resp.toBlockNumber)
      ) {
        resp.toBlockNumber = blockNumber;
      }
    });

    return { ...resp, ids: [...new Set(resp.ids).values()] };
  }

  // Utility method to create pagination parameters
  createPaginationConfig(
    pageSize: number,
    offset: number,
    endpoint: ApiEndpoint
  ): PaginationConfig {
    return {
      pageSize,
      offset,
      endpoint,
    };
  }

  // Utility method to validate endpoint configuration
  validateEndpoint(endpoint: ApiEndpoint): boolean {
    const url = this.gqlClientUrlsMap.get(endpoint);
    return !!url && url.length > 0;
  }

  // Method to get all configured endpoints
  getConfiguredEndpoints(): ApiEndpoint[] {
    return Array.from(this.gqlClientUrlsMap.keys()).filter((endpoint) =>
      this.validateEndpoint(endpoint)
    );
  }
}

export const GraphQlClientProviderFactory: Provider = {
  provide: GraphQlClientProviderToken,
  useClass: GraphqlClientProvider,
};

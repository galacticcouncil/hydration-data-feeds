import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLClient, Variables } from 'graphql-request';
import type { RequestDocument } from 'graphql-request';
import { AppConfig } from '../../config/app.config';
import { getGraphQLClientConfig } from '../../config/graphql-client.config';

@Injectable()
export class GraphqlClientService {
  private readonly logger = new Logger(GraphqlClientService.name);
  private client: GraphQLClient;

  constructor(private configService: ConfigService<AppConfig>) {
    const config = getGraphQLClientConfig(this.configService);
    this.client = new GraphQLClient(config.endpoint);
    this.logger.log(`GraphQL client initialized for ${config.endpoint}`);
  }

  async query<T = any, V extends Variables = Variables>(
    query: RequestDocument,
    variables?: V,
  ): Promise<T> {
    return this.client.request<T>(query, variables as any);
  }

  // Method signature required for DI token compatibility — resolved to
  // MultiEndpointGraphqlService.getCurrentBlockHeight() at runtime
  async getCurrentBlockHeight(): Promise<number> {
    throw new Error('Not implemented — resolved via DI to MultiEndpointGraphqlService');
  }
}

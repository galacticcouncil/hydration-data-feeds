import { ConfigService } from '@nestjs/config';
import { AppConfig } from './app.config';

export interface GraphQLClientConfig {
  endpoint: string;
  timeout: number;
  retries: number;
  retryDelay: number;
}

export const getGraphQLClientConfig = (
  configService: ConfigService<AppConfig>,
): GraphQLClientConfig => {
  const graphqlConfig = configService.get('graphql', { infer: true });

  if (!graphqlConfig || !graphqlConfig.endpoint) {
    throw new Error('GraphQL configuration is missing');
  }

  return {
    endpoint: graphqlConfig.endpoint,
    timeout: 30000, // 30 seconds
    retries: 3,
    retryDelay: 1000, // 1 second
  };
};

import { Injectable } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsOptional, IsUrl, ValidationError } from 'class-validator';
import * as dotenv from 'dotenv';
import { transformAndValidateSync } from 'class-transformer-validator';

dotenv.config({
  path: (() => {
    const envFileName = '.env';
    console.log(`${__dirname}/../../../${envFileName}`);
    return `${__dirname}/../../../${envFileName}`;
  })(),
});

export class GraphQLConfig {
  private static instance: GraphQLConfig;

  @IsNotEmpty()
  @IsUrl()
  readonly MAIN_INDEXER_GRAPHQL_ENDPOINT!: string;

  @IsOptional()
  @IsString()
  readonly GRAPHQL_API_KEY?: string;

  @IsOptional()
  @IsUrl()
  readonly GRAPHQL_HISTORICAL_ENDPOINT?: string;

  @IsOptional()
  @IsUrl()
  readonly GRAPHQL_ANALYTICS_ENDPOINT?: string;

  @IsOptional()
  @IsUrl()
  readonly GRAPHQL_PAIRS_ENDPOINT?: string;

  @IsOptional()
  @IsUrl()
  readonly GRAPHQL_ASSETS_ENDPOINT?: string;

  @IsOptional()
  @IsUrl()
  readonly GRAPHQL_EVENTS_ENDPOINT?: string;

  @Transform(({ value }: { value: string }) => +value)
  readonly GRAPHQL_REQUEST_TIMEOUT_MS: number = 30_000;

  @Transform(({ value }: { value: string }) => +value)
  readonly GRAPHQL_MAX_RETRY_ATTEMPTS: number = 3;

  @Transform(({ value }: { value: string }) => +value)
  readonly GRAPHQL_RETRY_DELAY_MS: number = 1_000;

  @Transform(({ value }: { value: string }) => +value)
  readonly GRAPHQL_MAX_RETRY_DELAY_MS: number = 15_000;

  static getInstance(): GraphQLConfig {
    if (GraphQLConfig.instance) return GraphQLConfig.instance;

    try {
      GraphQLConfig.instance = transformAndValidateSync(GraphQLConfig, process.env, {
        validator: { stopAtFirstError: true },
      });
      return GraphQLConfig.instance;
    } catch (errors) {
      if (Array.isArray(errors) && errors[0] instanceof ValidationError) {
        errors.forEach((error: ValidationError) => {
          // @ts-ignore
          Object.values(error.constraints).forEach((msg) => console.error(msg));
        });
      } else {
        console.error('Unexpected error during the environment validation');
      }
      throw new Error('Failed to validate environment variables');
    }
  }

  // Get endpoint URL with fallback to main endpoint
  getEndpointUrl(endpoint: string): string {
    switch (endpoint) {
      case 'HISTORICAL':
        return this.GRAPHQL_HISTORICAL_ENDPOINT || this.MAIN_INDEXER_GRAPHQL_ENDPOINT;
      case 'ANALYTICS':
        return this.GRAPHQL_ANALYTICS_ENDPOINT || this.MAIN_INDEXER_GRAPHQL_ENDPOINT;
      case 'PAIRS':
        return this.GRAPHQL_PAIRS_ENDPOINT || this.MAIN_INDEXER_GRAPHQL_ENDPOINT;
      case 'ASSETS':
        return this.GRAPHQL_ASSETS_ENDPOINT || this.MAIN_INDEXER_GRAPHQL_ENDPOINT;
      case 'EVENTS':
        return this.GRAPHQL_EVENTS_ENDPOINT || this.MAIN_INDEXER_GRAPHQL_ENDPOINT;
      default:
        return this.MAIN_INDEXER_GRAPHQL_ENDPOINT;
    }
  }

  // Get configured endpoints
  getConfiguredEndpoints(): string[] {
    const endpoints = ['MAIN'];

    if (this.GRAPHQL_HISTORICAL_ENDPOINT) endpoints.push('HISTORICAL');
    if (this.GRAPHQL_ANALYTICS_ENDPOINT) endpoints.push('ANALYTICS');
    if (this.GRAPHQL_PAIRS_ENDPOINT) endpoints.push('PAIRS');
    if (this.GRAPHQL_ASSETS_ENDPOINT) endpoints.push('ASSETS');
    if (this.GRAPHQL_EVENTS_ENDPOINT) endpoints.push('EVENTS');

    return endpoints;
  }
}

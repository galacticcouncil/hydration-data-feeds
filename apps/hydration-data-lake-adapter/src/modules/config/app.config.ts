import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { transformAndValidateSync } from 'class-transformer-validator';
import 'reflect-metadata';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsOptional, IsEnum, ValidationError } from 'class-validator';
import { NodeEnv } from './types';
import { GraphQLConfig } from './graphql.config';
import * as dotenv from 'dotenv';

dotenv.config({
  path: (() => {
    const envFileName = '.env';
    console.log(`${__dirname}/../../../${envFileName}`);
    return `${__dirname}/../../../${envFileName}`;
  })(),
});

export class AppConfig {
  private static instance: AppConfig;

  @IsNotEmpty()
  @IsEnum(NodeEnv)
  readonly NODE_ENV: NodeEnv = NodeEnv.DEVELOPMENT;

  @Transform(({ value }: { value: string }) => +value)
  readonly PORT: number = 8080;

  @IsOptional()
  @IsString()
  readonly BASE_PATH?: string;

  @IsOptional()
  @IsString()
  readonly SERVER_URL?: string;

  @IsOptional()
  @IsString()
  readonly HOST?: string;

  @Transform(({ value }: { value: string }) => value === 'true')
  readonly FORCE_HTTP: boolean = true;

  @Transform(({ value }: { value: string }) => value.split(',') || [])
  readonly CORS_ORIGINS: string[] = ['http://localhost:8080'];

  @IsNotEmpty()
  @IsString()
  readonly DEX_KEY: string = 'hydration';

  @Transform(({ value }: { value: string }) => +value)
  readonly DEFAULT_CHAIN_ID: number = 1;

  @Transform(({ value }: { value: string }) => +value)
  readonly ENTITIES_CACHE_TTL_MS: number = -1; // -1 means cache never expires

  @Transform(({ value }: { value: string }) => +value)
  readonly API_CACHE_TTL_MS: number = 600_000; // 10 minutes

  @Transform(({ value }: { value: string }) => +value)
  readonly REQUEST_TIMEOUT_MS: number = 30_000;

  @Transform(({ value }: { value: string }) => +value)
  readonly MAX_BLOCK_RANGE: number = -1;

  @Transform(({ value }: { value: string }) => +value)
  readonly MAX_BLOCKS_RANGE_FETCH_BATCH: number = 300;

  @Transform(({ value }: { value: string }) => +value)
  readonly DEFAULT_PAGE_SIZE: number = 100;

  @Transform(({ value }: { value: string }) => +value)
  readonly MAX_PAGE_SIZE: number = 1000;

  @Transform(({ value }: { value: string }) => value === 'true')
  readonly ENABLE_CORS: boolean = true;

  @Transform(({ value }: { value: string }) => value === 'true')
  readonly ENABLE_SWAGGER: boolean = true;

  @Transform(({ value }: { value: string }) => value === 'true')
  readonly ENABLE_METRICS: boolean = false;

  @Transform(({ value }: { value: string }) => value === 'true')
  readonly ENABLE_HEALTH_CHECK: boolean = true;

  @Transform(({ value }: { value: string }) => value === 'true')
  readonly ENABLE_TYPED_GRAPHQL: boolean = true;

  @Transform(({ value }: { value: string }) => +value)
  readonly HYDRADX_SS58_PREFIX: number = 0;

  @IsOptional()
  @IsString()
  readonly LOG_LEVEL?: string;

  @Transform(({ value }: { value: string }) => value === 'true')
  readonly IGNORE_INVALID_ENTITIES?: boolean = true;

  @Transform(({ value }: { value: string }) => value === 'true')
  readonly ENABLE_DEBUG_LOGGING: boolean = false;

  public graphql: GraphQLConfig = GraphQLConfig.getInstance();

  static getInstance(): AppConfig {
    if (AppConfig.instance) return AppConfig.instance;

    try {
      AppConfig.instance = transformAndValidateSync(AppConfig, process.env, {
        validator: { stopAtFirstError: true },
      });
      return AppConfig.instance;
    } catch (errors) {
      if (Array.isArray(errors) && errors[0] instanceof ValidationError) {
        errors.forEach((error: ValidationError) => {
          Object.values(error.constraints).forEach((msg) => console.error(msg));
        });
      } else {
        console.error('Unexpected error during the environment validation');
      }
      console.dir(errors, { depth: null });
      throw new Error('Failed to validate environment variables');
    }
  }

  // Utility methods
  isDevelopment(): boolean {
    return this.NODE_ENV === NodeEnv.DEVELOPMENT;
  }

  isProduction(): boolean {
    return this.NODE_ENV === NodeEnv.PRODUCTION;
  }

  isTest(): boolean {
    return this.NODE_ENV === NodeEnv.TEST;
  }

  getServerUrl(): string {
    if (this.SERVER_URL) {
      return this.SERVER_URL;
    }

    // Fallback logic
    const protocol = this.FORCE_HTTP ? 'http' : this.isProduction() ? 'https' : 'http';
    const host = this.HOST || 'localhost';
    const port = this.PORT !== 80 && this.PORT !== 443 ? `:${this.PORT}` : '';
    const basePath = this.BASE_PATH || '';
    return `${protocol}://${host}${port}${basePath}`;
  }

  // Validation methods
  validateBlockRange(fromBlock: number, toBlock: number): void {
    if (fromBlock > toBlock) {
      throw new Error('fromBlock must be less than or equal to toBlock');
    }

    if (this.MAX_BLOCK_RANGE > 0 && toBlock - fromBlock > this.MAX_BLOCK_RANGE) {
      throw new Error(`Block range cannot exceed ${this.MAX_BLOCK_RANGE} blocks`);
    }
  }

  validatePageSize(pageSize: number): number {
    if (pageSize <= 0) {
      return this.DEFAULT_PAGE_SIZE;
    }

    if (pageSize > this.MAX_PAGE_SIZE) {
      return this.MAX_PAGE_SIZE;
    }

    return pageSize;
  }

  // Configuration summary for logging
  getConfigSummary() {
    return {
      nodeEnv: this.NODE_ENV,
      port: this.PORT,
      dexKey: this.DEX_KEY,
      chainId: this.DEFAULT_CHAIN_ID,
      enabledFeatures: {
        cors: this.ENABLE_CORS,
        swagger: this.ENABLE_SWAGGER,
        metrics: this.ENABLE_METRICS,
        healthCheck: this.ENABLE_HEALTH_CHECK,
        typedGraphQL: this.ENABLE_TYPED_GRAPHQL,
        debugLogging: this.ENABLE_DEBUG_LOGGING,
      },
      graphqlEndpoints: this.graphql.getConfiguredEndpoints(),
    };
  }
}

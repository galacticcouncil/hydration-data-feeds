import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { ConsumerRegistryService } from './consumer-registry.service';
import { ConsumerType, ApiVersion } from './types';
import { AppConfig } from '../config';

@Controller('api')
export class ConsumerInfoController {
  constructor(
    private readonly consumerRegistry: ConsumerRegistryService,
    private readonly appConfig: AppConfig,
  ) {}

  @Get('info')
  async getApiInfo() {
    const consumerSummary = this.consumerRegistry.getConsumerSummary();

    return {
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        name: 'Hydration Data Lake Adapter',
        description: 'Multi-consumer REST API adapter for Hydration GraphQL data sources',
        version: '1.0.0',
        environment: this.appConfig.NODE_ENV,
        dexKey: this.appConfig.DEX_KEY,
        consumers: consumerSummary,
        endpoints: {
          info: 'GET /api/info - This endpoint',
          consumers: 'GET /api/consumers - List all consumers',
          consumer: 'GET /api/consumers/:type/:version - Get specific consumer info',
          health: 'GET /api/health - Overall health check',
        },
      },
    };
  }

  @Get('consumers')
  async getAllConsumers() {
    const consumers = this.consumerRegistry.getAllConsumers();

    return {
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        total: consumers.length,
        enabled: consumers.filter(c => c.enabled).length,
        consumers: consumers.map(consumer => ({
          type: consumer.type,
          version: consumer.version,
          enabled: consumer.enabled,
          basePath: consumer.basePath,
          description: consumer.description,
          endpoints: this.getConsumerEndpoints(consumer.basePath),
        })),
      },
    };
  }

  @Get('consumers/:type/:version')
  async getConsumerInfo(
    @Param('type') type: string,
    @Param('version') version: string,
  ) {
    // Validate and convert parameters
    if (!Object.values(ConsumerType).includes(type as ConsumerType)) {
      throw new HttpException(
        {
          success: false,
          error: `Invalid consumer type: ${type}`,
          validTypes: Object.values(ConsumerType),
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!Object.values(ApiVersion).includes(version as ApiVersion)) {
      throw new HttpException(
        {
          success: false,
          error: `Invalid API version: ${version}`,
          validVersions: Object.values(ApiVersion),
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const consumer = this.consumerRegistry.getConsumer(
      type as ConsumerType,
      version as ApiVersion,
    );

    if (!consumer) {
      throw new HttpException(
        {
          success: false,
          error: `Consumer not found: ${type} ${version}`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        ...consumer,
        endpoints: this.getConsumerEndpoints(consumer.basePath),
        isEnabled: consumer.enabled,
        fullPath: `/${consumer.basePath}`,
      },
    };
  }

  @Get('health')
  async getOverallHealth() {
    const enabledConsumers = this.consumerRegistry.getEnabledConsumers();
    const totalConsumers = this.consumerRegistry.getAllConsumers().length;

    return {
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        status: 'OK',
        application: {
          name: 'Hydration Data Lake Adapter',
          environment: this.appConfig.NODE_ENV,
          port: this.appConfig.PORT,
          uptime: process.uptime(),
        },
        consumers: {
          total: totalConsumers,
          enabled: enabledConsumers.length,
          disabled: totalConsumers - enabledConsumers.length,
        },
        graphql: {
          endpoints: this.appConfig.graphql.getConfiguredEndpoints(),
          mainEndpoint: this.appConfig.graphql.MAIN_INDEXER_GRAPHQL_ENDPOINT,
        },
      },
    };
  }

  private getConsumerEndpoints(basePath: string): string[] {
    // This could be made more dynamic by introspecting the controller routes
    // For now, we'll return the standard DEX Screener endpoints
    if (basePath.includes('dexscreener')) {
      return [
        `GET /${basePath}/latest-block`,
        `GET /${basePath}/asset?id=:string`,
        `GET /${basePath}/pair?id=:string`,
        `GET /${basePath}/events?fromBlock=:number&toBlock=:number`,
        `GET /${basePath}/health`,
      ];
    }

    // Default endpoints for future consumers
    return [
      `GET /${basePath}/health`,
    ];
  }
}

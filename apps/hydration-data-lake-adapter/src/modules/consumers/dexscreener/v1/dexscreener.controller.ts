import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { BaseConsumerHelper } from '../../base/base.helper';
import { AppConfig } from '../../../config';
import { DexScreenerTransformer } from './dexscreener.transformer';
import { ConsumerType, ApiVersion } from '../../types';
import {
  DexScreenerGetEventsQueryDto,
  DexScreenerGetAssetParamsDto,
  DexScreenerGetPairParamsDto,
} from './dexscreener.dto';
import {
  DexScreenerLatestBlockResponse,
  DexScreenerAssetResponse,
  DexScreenerPairResponse,
  DexScreenerEventsResponse,
} from './dexscreener.interfaces';
import { ApiEndpoint } from '../../../dataSource/types';
import { BaseConsumerController } from '../../base/base.controller';
import { DexscreenerResolver } from './dexscreener.resolver';
import { AssetEnhancementService } from '../../../../data';

const dexscrennerConsumerBasePath = `${ApiVersion.V1}/${ConsumerType.DEX_SCREENER}`;

@ApiTags('dexscreener')
@Controller(dexscrennerConsumerBasePath)
export class DexScreenerV1Controller extends BaseConsumerController {
  constructor(
    private readonly dexscreenerResolver: DexscreenerResolver,
    protected readonly appConfig: AppConfig,
    private readonly assetEnhancementService: AssetEnhancementService,
  ) {
    super(appConfig);
  }

  getConsumerType(): ConsumerType {
    return ConsumerType.DEX_SCREENER;
  }

  getApiVersion(): ApiVersion {
    return ApiVersion.V1;
  }

  getBasePath(): string {
    return dexscrennerConsumerBasePath;
  }

  @Get('latest-block')
  @ApiOperation({
    summary: 'Get latest indexed block',
    description:
      'Returns the latest block that has been indexed and is available for data retrieval.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved the latest block information',
    schema: {
      type: 'object',
      properties: {
        block: {
          type: 'object',
          properties: {
            blockNumber: { type: 'number', example: 100 },
            blockTimestamp: { type: 'number', example: 1698126147 },
            metadata: {
              type: 'object',
              additionalProperties: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getLatestBlock(): Promise<DexScreenerLatestBlockResponse> {
    return this.dexscreenerResolver.resolveGetLatestBlock();
  }

  @Get('asset')
  async getAsset(@Query() query: DexScreenerGetAssetParamsDto): Promise<DexScreenerAssetResponse> {
    const { id } = query;
    return this.dexscreenerResolver.resolveGetAssetById(id);
  }
  //
  // @Get('pair')
  // async getPair(@Query() query: DexScreenerGetPairParamsDto): Promise<DexScreenerPairResponse> {
  //   try {
  //     const { id } = query;
  //     this.logRequest('pair', { id });
  //
  //     if (!id) {
  //       throw new HttpException(
  //         this.createErrorResponse('Pair ID is required', HttpStatus.BAD_REQUEST),
  //         HttpStatus.BAD_REQUEST
  //       );
  //     }
  //
  //     // Fetch data from GraphQL API
  //     const graphqlData = await this.typedGraphqlService.getPair(id, ApiEndpoint.PAIRS);
  //
  //     if (!graphqlData?.pair) {
  //       throw new HttpException(
  //         this.createErrorResponse(`Pair with ID ${id} was not found`, HttpStatus.NOT_FOUND),
  //         HttpStatus.NOT_FOUND
  //       );
  //     }
  //
  //     // Transform using DEX Screener specific transformer
  //     const response = this.dexScreenerTransformer.transformPair(graphqlData);
  //
  //     this.logger.log(`Pair fetched: ${id}`);
  //     return response;
  //   } catch (error) {
  //     if (error instanceof HttpException) {
  //       throw error;
  //     }
  //
  //     this.logger.error(`Failed to fetch pair: ${error.message}`, error.stack);
  //     throw new HttpException(
  //       this.createErrorResponse('Failed to fetch pair', HttpStatus.INTERNAL_SERVER_ERROR),
  //       HttpStatus.INTERNAL_SERVER_ERROR
  //     );
  //   }
  // }
  //
  // @Get('events')
  // async getEvents(
  //   @Query() query: DexScreenerGetEventsQueryDto
  // ): Promise<DexScreenerEventsResponse> {
  //   try {
  //     const { fromBlock, toBlock } = query;
  //     this.logRequest('events', { fromBlock, toBlock });
  //
  //     // Validate block range using base controller method
  //     try {
  //       this.validateBlockRange(fromBlock, toBlock);
  //     } catch (error) {
  //       throw new HttpException(
  //         this.createErrorResponse(error.message, HttpStatus.BAD_REQUEST),
  //         HttpStatus.BAD_REQUEST
  //       );
  //     }
  //
  //     // Fetch data from GraphQL API
  //     const graphqlData = await this.typedGraphqlService.getEvents(
  //       { fromBlock, toBlock },
  //       ApiEndpoint.EVENTS
  //     );
  //
  //     if (!graphqlData?.events) {
  //       throw new HttpException(
  //         this.createErrorResponse(
  //           'No events found for the specified block range',
  //           HttpStatus.NOT_FOUND
  //         ),
  //         HttpStatus.NOT_FOUND
  //       );
  //     }
  //
  //     // Transform using DEX Screener specific transformer
  //     const response = this.dexScreenerTransformer.transformEvents(graphqlData);
  //
  //     this.logger.log(
  //       `Events fetched: ${response.events.length} events from blocks ${fromBlock}-${toBlock}`
  //     );
  //     return response;
  //   } catch (error) {
  //     if (error instanceof HttpException) {
  //       throw error;
  //     }
  //
  //     this.logger.error(`Failed to fetch events: ${error.message}`, error.stack);
  //     throw new HttpException(
  //       this.createErrorResponse('Failed to fetch events', HttpStatus.INTERNAL_SERVER_ERROR),
  //       HttpStatus.INTERNAL_SERVER_ERROR
  //     );
  //   }
  // }

  @Get('health')
  @ApiOperation({
    summary: 'Health check',
    description: 'Returns the health status of the DEX Screener adapter and available endpoints.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            consumer: { type: 'string', example: 'dexscreener' },
            version: { type: 'string', example: 'v1' },
            status: { type: 'string', example: 'OK' },
            endpoints: {
              type: 'array',
              items: { type: 'string' },
              example: ['latest-block', 'asset', 'pair', 'events'],
            },
          },
        },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
      },
    },
  })
  async healthCheck() {
    return this.createSuccessResponse({
      consumer: this.getConsumerType(),
      version: this.getApiVersion(),
      status: 'OK',
      endpoints: ['latest-block', 'asset', 'pair', 'events'],
    });
  }
}

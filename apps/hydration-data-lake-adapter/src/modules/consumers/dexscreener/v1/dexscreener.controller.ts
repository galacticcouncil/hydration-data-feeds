import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
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

const dexscrennerConsumerBasePath = `${ApiVersion.V1}/${ConsumerType.DEX_SCREENER}`;

@Controller(dexscrennerConsumerBasePath)
export class DexScreenerV1Controller extends BaseConsumerController {
  constructor(
    private readonly dexscreenerResolver: DexscreenerResolver,
    protected readonly appConfig: AppConfig
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
  async getLatestBlock(): Promise<DexScreenerLatestBlockResponse> {
    return this.dexscreenerResolver.resolveGetLatestBlock();
  }
  //
  // @Get('asset')
  // async getAsset(@Query() query: DexScreenerGetAssetParamsDto): Promise<DexScreenerAssetResponse> {
  //   try {
  //     const { id } = query;
  //     this.logRequest('asset', { id });
  //
  //     if (!id) {
  //       throw new HttpException(
  //         this.createErrorResponse('Asset ID is required', HttpStatus.BAD_REQUEST),
  //         HttpStatus.BAD_REQUEST
  //       );
  //     }
  //
  //     // Fetch data from GraphQL API
  //     const graphqlData = await this.typedGraphqlService.getAsset(id, ApiEndpoint.ASSETS);
  //
  //     if (!graphqlData?.asset) {
  //       throw new HttpException(
  //         this.createErrorResponse(`Asset with ID ${id} was not found`, HttpStatus.NOT_FOUND),
  //         HttpStatus.NOT_FOUND
  //       );
  //     }
  //
  //     // Transform using DEX Screener specific transformer
  //     const response = this.dexScreenerTransformer.transformAsset(graphqlData);
  //
  //     this.logger.log(`Asset fetched: ${response.asset.symbol} (${id})`);
  //     return response;
  //   } catch (error) {
  //     if (error instanceof HttpException) {
  //       throw error;
  //     }
  //
  //     this.logger.error(`Failed to fetch asset: ${error.message}`, error.stack);
  //     throw new HttpException(
  //       this.createErrorResponse('Failed to fetch asset', HttpStatus.INTERNAL_SERVER_ERROR),
  //       HttpStatus.INTERNAL_SERVER_ERROR
  //     );
  //   }
  // }
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
  async healthCheck() {
    return this.createSuccessResponse({
      consumer: this.getConsumerType(),
      version: this.getApiVersion(),
      status: 'OK',
      endpoints: ['latest-block', 'asset', 'pair', 'events'],
    });
  }
}

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
  DexScreenerEventsResponse,
} from './dexscreener.interfaces';
import { BaseConsumerController } from '../../base/base.controller';
import { DexscreenerResolver } from './dexscreener.resolver';
import { DexScreenerSwagger } from './dexscreener.swagger';

const dexscrennerConsumerBasePath = `${ApiVersion.V1}/${ConsumerType.DEX_SCREENER}`;

@ApiTags('dexscreener')
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
  @DexScreenerSwagger.getLatestBlock()
  async getLatestBlock(): Promise<DexScreenerLatestBlockResponse> {
    return this.dexscreenerResolver.resolveGetLatestBlock();
  }

  @Get('asset')
  @DexScreenerSwagger.getAsset()
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
  @Get('events')
  @DexScreenerSwagger.getEvents()
  async getEvents(
    @Query() query: DexScreenerGetEventsQueryDto
  ): Promise<DexScreenerEventsResponse> {
    return this.dexscreenerResolver.resolveGetEventsInBlocksRange(query);
  }

  @Get('health')
  @DexScreenerSwagger.healthCheck()
  async healthCheck() {
    return this.createSuccessResponse({
      consumer: this.getConsumerType(),
      version: this.getApiVersion(),
      status: 'OK',
      endpoints: ['latest-block', 'asset', 'pair', 'events'],
    });
  }
}

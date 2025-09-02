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
  DexScreenerPairResponse,
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

  @Get('pair')
  @DexScreenerSwagger.getPair()
  async getPair(@Query() query: DexScreenerGetPairParamsDto): Promise<DexScreenerPairResponse> {
    return this.dexscreenerResolver.resolveGetPairById(query);
  }

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

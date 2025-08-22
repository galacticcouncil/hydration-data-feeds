import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config';
import { BaseTransformer } from '../../base/base.transformer';
import {
  DexScreenerLatestBlockResponse,
  DexScreenerAssetResponse,
  DexScreenerPairResponse,
  DexScreenerEventsResponse,
  DexScreenerBlock,
  DexScreenerAsset,
  DexScreenerPair,
  DexScreenerSwapEvent,
  DexScreenerJoinExitEvent,
  DexScreenerEvent,
} from './dexscreener.interfaces';
import { DataSourceService } from '../../../dataSource/data-source.service';
import { ApiEndpoint } from '../../../dataSource/types';
import { BaseConsumerHelper } from '../../base/base.helper';
import { DexScreenerTransformer } from './dexscreener.transformer';
import { ConsumerType } from '../../types';

@Injectable()
export class DexscreenerResolver extends BaseConsumerHelper {
  constructor(
    appConfig: AppConfig,
    private dataSourceService: DataSourceService,
    private dexScreenerTransformer: DexScreenerTransformer
  ) {
    super(appConfig);
  }

  async resolveGetLatestBlock() {
    try {
      this.logRequest(ConsumerType.DEX_SCREENER, 'latest-block');

      // Fetch data from GraphQL API
      const graphqlData = await this.dataSourceService.getLatestProcessedBlock({
        endpoint: ApiEndpoint.MAIN_INDEXER_API,
      });

      if (!graphqlData) {
        throw new HttpException(
          this.createErrorResponse('Latest block not found'),
          HttpStatus.NOT_FOUND
        );
      }

      const response = this.dexScreenerTransformer.transformBlock(graphqlData);

      this.logger.log(`Latest block fetched: ${response.block.blockNumber}`);
      return response;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Failed to fetch latest block: ${error.message}`, error.stack);
      throw new HttpException(
        this.createErrorResponse('Failed to fetch latest block', HttpStatus.INTERNAL_SERVER_ERROR),
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async resolveGetAssetById(id: string): Promise<DexScreenerAssetResponse> {
    try {
      this.logRequest(ConsumerType.DEX_SCREENER, 'asset');

      // TODO add validation for none id

      // Fetch data from GraphQL API
      const assetData = await this.dataSourceService.getAssetById({
        id,
        endpoint: ApiEndpoint.MAIN_INDEXER_API,
      });

      if (!assetData) {
        throw new HttpException(this.createErrorResponse('Asset not found'), HttpStatus.NOT_FOUND);
      }

      const response = this.dexScreenerTransformer.transformAsset(assetData);

      this.logger.log(`Asset fetched: ${response.asset.id}`);
      return response;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Failed to fetch asset: ${error.message}`, error.stack);
      throw new HttpException(
        this.createErrorResponse('Failed to fetch asset', HttpStatus.INTERNAL_SERVER_ERROR),
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

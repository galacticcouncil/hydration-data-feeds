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
  DexScreenerEventWithBlock,
  DexScreenerEventType,
} from './dexscreener.interfaces';
import { DataSourceService } from '../../../dataSource/data-source.service';
import { ApiEndpoint } from '../../../dataSource/types';
import { BaseConsumerHelper } from '../../base/base.helper';
import { DexScreenerTransformer } from './dexscreener.transformer';
import { ConsumerType } from '../../types';
import { DexScreenerGetEventsQueryDto } from './dexscreener.dto';
import { DexScreenerEntitiesService } from '../../../entities/dexscreener-entities.service';
import { fromExpToDecimalNotation, publicKeyToSs58 } from '../../../../utils';

@Injectable()
export class DexscreenerResolver extends BaseConsumerHelper {
  constructor(
    appConfig: AppConfig,
    private dataSourceService: DataSourceService,
    private dexScreenerTransformer: DexScreenerTransformer,
    private dexScreenerEntitiesService: DexScreenerEntitiesService
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

      const blockEntity = await this.dexScreenerEntitiesService.getOrCreateBlock({
        height: graphqlData.height,
        data: graphqlData,
      });

      const response = { block: blockEntity };

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

  async resolveGetEventsInBlocksRange({
    fromBlock,
    toBlock,
  }: DexScreenerGetEventsQueryDto): Promise<DexScreenerEventsResponse> {
    try {
      this.logRequest(ConsumerType.DEX_SCREENER, 'events', { fromBlock, toBlock });

      // Validate block range using base controller method
      try {
        this.validateBlockRange(fromBlock, toBlock);
      } catch (error) {
        throw new HttpException(
          this.createErrorResponse(error.message, HttpStatus.BAD_REQUEST),
          HttpStatus.BAD_REQUEST
        );
      }

      // Fetch data from GraphQL API
      const swappedEvents = await this.dataSourceService.getSwapsInBlocksRange({
        fromBlock,
        toBlock,
        endpoint: ApiEndpoint.MAIN_INDEXER_API,
      });

      if (!swappedEvents || swappedEvents.length === 0) {
        throw new HttpException(
          this.createErrorResponse(
            'No events found for the specified block range',
            HttpStatus.NOT_FOUND
          ),
          HttpStatus.NOT_FOUND
        );
      }

      const events = [];

      for (const swappedEvent of swappedEvents) {
        // TODO implement opportunity to process Swapped events with more than one asset in input or output

        const eventBlock = await this.dexScreenerEntitiesService.getOrCreateBlock({
          height: swappedEvent.paraBlockHeight,
        });

        const swapInput = swappedEvent.swapInputs.nodes[0];
        const swapOutput = swappedEvent.swapOutputs.nodes[0];
        const swapInputAmountDecorated = fromExpToDecimalNotation(
          swapInput.amount,
          swapInput.asset.decimals
        ).toFixed();
        const swapOutputAmountDecorated = fromExpToDecimalNotation(
          swapOutput.amount,
          swapOutput.asset.decimals
        ).toFixed();

        const eventPair = await this.dexScreenerEntitiesService.getOrCreatePair({
          assetIds: [swapInput.asset.id, swapOutput.asset.id],
        });

        const newEvent: DexScreenerEventWithBlock = {
          block: eventBlock,

          eventType: DexScreenerEventType.SWAP,
          txnId: swappedEvent.routedTradeId,
          txnIndex: swappedEvent.swapIndex,
          eventIndex: swappedEvent.event.indexInBlock,
          maker: publicKeyToSs58(swappedEvent.swapperId, this.appConfig.HYDRADX_SS58_PREFIX), // TODO convert to ss58 format
          pairId: eventPair.id,
          priceNative: '0',
          reserves: {
            asset0: '0',
            asset1: '0',
          },
          ...(eventPair.asset0Id === swapInput.asset.id && {
            asset0In: swapInputAmountDecorated,
          }),
          ...(eventPair.asset1Id === swapInput.asset.id && {
            asset1In: swapInputAmountDecorated,
          }),
          ...(eventPair.asset0Id === swapOutput.asset.id && {
            asset0Out: swapOutputAmountDecorated,
          }),
          ...(eventPair.asset1Id === swapOutput.asset.id && {
            asset1Out: swapOutputAmountDecorated,
          }),
        };

        events.push(newEvent);
      }
      this.logger.log(
        `Events fetched: ${events.length} events from blocks ${fromBlock}-${toBlock}`
      );
      return { events };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Failed to fetch events: ${error.message}`, error.stack);
      throw new HttpException(
        this.createErrorResponse('Failed to fetch events', HttpStatus.INTERNAL_SERVER_ERROR),
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    // try {
    //   this.logRequest(ConsumerType.DEX_SCREENER, 'asset');
    //
    //   // TODO add validation for none id
    //
    //   // Fetch data from GraphQL API
    //   const assetData = await this.dataSourceService.getAssetById({
    //     id,
    //     endpoint: ApiEndpoint.MAIN_INDEXER_API,
    //   });
    //
    //   if (!assetData) {
    //     throw new HttpException(this.createErrorResponse('Asset not found'), HttpStatus.NOT_FOUND);
    //   }
    //
    //   const response = this.dexScreenerTransformer.transformAsset(assetData);
    //
    //   this.logger.log(`Asset fetched: ${response.asset.id}`);
    //   return response;
    // } catch (error) {
    //   if (error instanceof HttpException) {
    //     throw error;
    //   }
    //
    //   this.logger.error(`Failed to fetch asset: ${error.message}`, error.stack);
    //   throw new HttpException(
    //     this.createErrorResponse('Failed to fetch asset', HttpStatus.INTERNAL_SERVER_ERROR),
    //     HttpStatus.INTERNAL_SERVER_ERROR
    //   );
    // }
  }
}

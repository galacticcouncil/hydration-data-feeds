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
import { ApiEndpoint, AssetType, PoolType } from '../../../dataSource/types';
import { BaseConsumerHelper } from '../../base/base.helper';
import { DexScreenerTransformer } from './dexscreener.transformer';
import { ConsumerType } from '../../types';
import { DexScreenerGetEventsQueryDto, DexScreenerGetPairParamsDto } from './dexscreener.dto';
import { DexScreenerEntitiesService } from '../../../entities/dexscreener-entities.service';
import { fromExpToDecimalNotation, publicKeyToSs58 } from '../../../../utils';
import pMap from 'p-map';

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

      const blockEntity = await this.dexScreenerEntitiesService.getOrCreateLatestProcessedBlock();

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

      if (!id) {
        throw new HttpException(
          this.createErrorResponse('Asset ID is required', HttpStatus.BAD_REQUEST),
          HttpStatus.BAD_REQUEST
        );
      }

      const response: DexScreenerAssetResponse = {
        asset: await this.dexScreenerEntitiesService.getOrCreateAsset(id),
      };

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

  async resolveGetPairById(query: DexScreenerGetPairParamsDto): Promise<DexScreenerPairResponse> {
    try {
      const { id } = query;

      this.logRequest(ConsumerType.DEX_SCREENER, 'pair');

      if (!id) {
        throw new HttpException(
          this.createErrorResponse('Pair ID is required', HttpStatus.BAD_REQUEST),
          HttpStatus.BAD_REQUEST
        );
      }

      const pairAssetIds = id.split('-');

      if (pairAssetIds.length !== 2) {
        throw new HttpException(
          this.createErrorResponse('Pair ID is invalid', HttpStatus.BAD_REQUEST),
          HttpStatus.BAD_REQUEST
        );
      }

      const response: DexScreenerPairResponse = {
        pair: await this.dexScreenerEntitiesService.getOrCreatePair({ assetIds: pairAssetIds }),
      };

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
      const swappedEvents = await this.dataSourceService.fetchSwapsInBlocksRange({
        fromBlock,
        toBlock,
        endpoint: ApiEndpoint.MAIN_INDEXER_API,
      });

      if (!swappedEvents) {
        throw new HttpException(
          this.createErrorResponse(
            'No events found for the specified block range due to error ',
            HttpStatus.NOT_FOUND
          ),
          HttpStatus.NOT_FOUND
        );
      }
      if (swappedEvents.length === 0) return { events: [] };

      const events = [];

      await pMap(
        swappedEvents,
        async (swappedEvent) => {
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

          let asset0Reserve = '0';
          let asset1Reserve = '0';

          if (swappedEvent.fillerType === PoolType.AAVE) {
            // TODO check implementation
            const aTokenId =
              swapInput.asset.assetType === AssetType.Erc20
                ? swapInput.asset.id
                : swapOutput.asset.id;

            asset0Reserve = await this.getEventAssetReserve({
              poolType: swappedEvent.fillerType as PoolType,
              poolAddress: swappedEvent.fillerId,
              assetId: aTokenId,
              blockHeight: swappedEvent.paraBlockHeight,
            });
            asset1Reserve = asset0Reserve;
          } else {
            asset0Reserve = await this.getEventAssetReserve({
              poolType: swappedEvent.fillerType as PoolType,
              poolAddress: swappedEvent.fillerId,
              assetId: eventPair.asset0Id,
              blockHeight: swappedEvent.paraBlockHeight,
            });

            asset1Reserve = await this.getEventAssetReserve({
              poolType: swappedEvent.fillerType as PoolType,
              poolAddress: swappedEvent.fillerId,
              assetId: eventPair.asset1Id,
              blockHeight: swappedEvent.paraBlockHeight,
            });
          }

          const newEvent: DexScreenerEventWithBlock = {
            block: eventBlock,

            eventType: DexScreenerEventType.SWAP,
            txnId: swappedEvent.routedTradeId,
            txnIndex: swappedEvent.swapIndex,
            eventIndex: swappedEvent.event.indexInBlock,
            maker: publicKeyToSs58(swappedEvent.swapperId, this.appConfig.HYDRADX_SS58_PREFIX),
            pairId: eventPair.id,
            priceNative: '0', // TODO add implementation
            reserves: {
              asset0: asset0Reserve,
              asset1: asset1Reserve,
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
        },
        { concurrency: 10 }
      );

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
  }

  private async getEventAssetReserve({
    poolType,
    poolAddress,
    assetId,
    blockHeight,
  }: {
    poolType: PoolType;
    poolAddress: string;
    assetId: string;
    blockHeight: number;
  }) {
    const assetEntity = await this.dexScreenerEntitiesService.getOrCreateAsset(assetId);

    if (assetEntity.metadata.assetType === AssetType.StableSwap) {
      // get total issuance of share asset
      const assetHistData = await this.dataSourceService.fetchAssetHistDataByBlockHeight({
        assetId,
        blockHeight,
        endpoint: ApiEndpoint.MAIN_INDEXER_API,
      });

      if (!assetHistData) {
        throw new HttpException(
          BaseConsumerHelper.getErrorResponsePayload('Asset Historical Data not found'),
          HttpStatus.NOT_FOUND
        );
      }

      return assetHistData.totalIssuance;
    }

    if (poolType === PoolType.AAVE) {
      // TODO get balance of asset in AAVE pool

      const aavepool = await this.dataSourceService.fetchAavepool({
        aTokenId: assetId,
      });

      if (!aavepool) {
        throw new HttpException(
          BaseConsumerHelper.getErrorResponsePayload(`Aavepool with aToken ${assetId} not found`),
          HttpStatus.NOT_FOUND
        );
      }

      const aavepoolHistData = await this.dataSourceService.fetchAavepoolHistoricalDataAtBlock({
        poolId: aavepool.id,
        blockHeight,
        endpoint: ApiEndpoint.MAIN_INDEXER_API,
      });

      if (!aavepoolHistData) {
        throw new HttpException(
          BaseConsumerHelper.getErrorResponsePayload(
            `Aavepool historical data for pool ${aavepool.id} at block ${blockHeight} not found`
          ),
          HttpStatus.NOT_FOUND
        );
      }

      return aavepoolHistData.liquidityIn;
    }

    const accountAssetBalanceHistData =
      await this.dataSourceService.fetchAccountAssetBalanceHistDataByBlockHeight({
        assetId,
        accountPubKey: poolAddress,
        blockHeight,
        endpoint: ApiEndpoint.MAIN_INDEXER_API,
      });

    if (!accountAssetBalanceHistData) {
      throw new HttpException(
        BaseConsumerHelper.getErrorResponsePayload('Account asset historical data not found'),
        HttpStatus.NOT_FOUND
      );
    }

    return accountAssetBalanceHistData.transferable;
  }
}

import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config';
import {
  DexScreenerAssetResponse,
  DexScreenerPairResponse,
  DexScreenerEventsResponse,
  DexScreenerEventWithBlock,
  DexScreenerEventType,
} from './dexscreener.interfaces';
import { DataSourceService } from '../../../dataSource/data-source.service';
import { ApiEndpoint, AssetType, PoolType, SwapFillerType } from '../../../dataSource/types';
import { BaseConsumerHelper } from '../../base/base.helper';
import { DexScreenerTransformer } from './dexscreener.transformer';
import { ConsumerType } from '../../types';
import { DexScreenerGetEventsQueryDto, DexScreenerGetPairParamsDto } from './dto/api.dto';
import { DexScreenerEntitiesService } from '../../../entities/dexscreener-entities.service';
import { fromExpToDecimalNotation } from '../../../../utils';
import pMap from 'p-map';
import { BigNumber } from 'bignumber.js';
import { DexScreenerValidator } from './dexscreener.validator';

@Injectable()
export class DexscreenerResolver extends BaseConsumerHelper {
  constructor(
    appConfig: AppConfig,
    private dataSourceService: DataSourceService,
    private dexScreenerTransformer: DexScreenerTransformer,
    private dexScreenerEntitiesService: DexScreenerEntitiesService,
    private dexScreenerValidator: DexScreenerValidator
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

      if (!response)
        throw new HttpException(
          this.createErrorResponse(`Asset with ID: ${id} not found`, HttpStatus.NOT_FOUND),
          HttpStatus.NOT_FOUND
        );

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

      const pairIdParts = id.split('-');

      if (pairIdParts.length !== 1 && pairIdParts.length !== 3) {
        throw new HttpException(
          this.createErrorResponse('Pair ID is invalid', HttpStatus.BAD_REQUEST),
          HttpStatus.BAD_REQUEST
        );
      }

      let poolId = null;
      let pairAssetIds = [];

      if (pairIdParts.length === 1) {
        poolId = pairIdParts[0];
      } else if (pairIdParts.length === 3) {
        poolId = pairIdParts[0];
        pairAssetIds = [pairIdParts[1], pairIdParts[2]];
      }

      const response: DexScreenerPairResponse = {
        pair: await this.dexScreenerEntitiesService.getOrCreatePair({
          id,
          assetIds: pairAssetIds,
          poolAddress: poolId,
        }),
      };

      return response;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Failed to fetch pair: ${error.message}`, error.stack);
      throw new HttpException(
        this.createErrorResponse('Failed to fetch pair', HttpStatus.INTERNAL_SERVER_ERROR),
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

      const swappedEventsMerged = this.dataSourceService.mergeSplittedSwaps(swappedEvents);

      const events = [];

      await pMap(
        swappedEventsMerged,
        async (swappedEvent) => {
          // TODO implement opportunity to process Swapped events with more than one asset in input or output

          const eventBlock = await this.dexScreenerEntitiesService.getOrCreateBlock({
            height: swappedEvent.paraBlockHeight,
          });

          const swapInput = swappedEvent.swapInputs.nodes[0];
          const swapOutput = swappedEvent.swapOutputs.nodes[0];
          const swapInputAmountDecorated = fromExpToDecimalNotation(
            swapInput.amount,
            swapInput.asset.decimals ?? 18
          ).toFixed();
          const swapOutputAmountDecorated = fromExpToDecimalNotation(
            swapOutput.amount,
            swapOutput.asset.decimals ?? 18
          ).toFixed();

          const genericPool = await this.dexScreenerEntitiesService.getOrCreateGenericPool({
            id: swappedEvent.fillerId,
            data: {
              id: swappedEvent.fillerId,
              poolType: this.dexScreenerEntitiesService.getPoolTypeFromSwapFillerType(
                swappedEvent.fillerType as SwapFillerType
              ),
              assets: [],
            },
          });

          const eventPair = await this.dexScreenerEntitiesService.getOrCreatePair({
            assetIds: [swapInput.asset.id, swapOutput.asset.id],
            poolAddress: genericPool.id,
          });

          if (!eventPair) {
            this.logger.warn(
              `Pair for assets ${swapInput.asset.id} and ${swapOutput.asset.id} not found. Skipping event.`
            );
            return;
          }

          const asset0Decimals =
            swapInput.asset.id === eventPair.asset0Id
              ? swapInput.asset.decimals
              : swapOutput.asset.decimals;

          const asset1Decimals =
            swapInput.asset.id === eventPair.asset1Id
              ? swapInput.asset.decimals
              : swapOutput.asset.decimals;

          let asset0Reserve = '0';
          let asset1Reserve = '0';

          if (swappedEvent.fillerType === PoolType.AAVE) {
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
            txnId: swappedEvent.routedTradeId ?? swappedEvent.id,
            txnIndex: swappedEvent.swapIndex,
            eventIndex: swappedEvent.event.indexInBlock,
            maker: swappedEvent.swapperId,
            pairId: eventPair.id,
            priceNative: '0',
            reserves: {
              asset0: fromExpToDecimalNotation(asset0Reserve, asset0Decimals ?? 18).toFixed(),
              asset1: fromExpToDecimalNotation(asset1Reserve, asset1Decimals ?? 18).toFixed(),
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

          newEvent.priceNative = this.getEventPairNativePrice({ event: newEvent });

          const isEventValid = await this.dexScreenerValidator.isSwapEventValid(newEvent);
          if (!isEventValid && this.appConfig.IGNORE_INVALID_ENTITIES) {
            this.logger.warn(`Swap Event ${newEvent.txnId} is invalid`);
            return;
          } else if (!isEventValid && !this.appConfig.IGNORE_INVALID_ENTITIES) {
            throw new HttpException(
              BaseConsumerHelper.getErrorResponsePayload(`Swap Event ${newEvent.txnId} is invalid`),
              HttpStatus.UNPROCESSABLE_ENTITY
            );
          }
          events.push(newEvent);
        },
        { concurrency: 10 }
      );

      const eventsSorted = events.sort((a, b) => {
        if (a.block.blockNumber !== b.block.blockNumber) {
          return a.block.blockNumber - b.block.blockNumber;
        }
        return a.eventIndex - b.eventIndex;
      });

      this.logger.log(
        `Events fetched: ${events.length} events from blocks ${fromBlock}-${toBlock}`
      );
      return { events: eventsSorted };
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

  // TODO test it!
  private getEventPairNativePrice({ event }: { event: DexScreenerEventWithBlock }) {
    if ('asset0Out' in event) return BigNumber(event.asset1In).dividedBy(event.asset0Out).toFixed();
    if ('asset0In' in event) return BigNumber(event.asset1Out).dividedBy(event.asset0In).toFixed();
    return '0';
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

    if (!assetEntity && this.appConfig.IGNORE_INVALID_ENTITIES) {
      this.logger.warn(`Asset ${assetId} not found`);
      return '0';
    } else if (!assetEntity && !this.appConfig.IGNORE_INVALID_ENTITIES) {
      throw new HttpException(
        BaseConsumerHelper.getErrorResponsePayload(`Asset ${assetId} not found`),
        HttpStatus.NOT_FOUND
      );
    }

    if (assetEntity.metadata.assetType === AssetType.StableSwap) {
      // get total issuance of share asset
      const assetHistData = await this.dataSourceService.fetchAssetHistDataByBlockHeight({
        assetId,
        blockHeight,
        endpoint: ApiEndpoint.MAIN_INDEXER_API,
      });

      if (!assetHistData && this.appConfig.IGNORE_INVALID_ENTITIES) {
        this.logger.warn('Asset Historical Data not found');
        return '0';
      } else if (!assetHistData && !this.appConfig.IGNORE_INVALID_ENTITIES) {
        throw new HttpException(
          BaseConsumerHelper.getErrorResponsePayload('Asset Historical Data not found'),
          HttpStatus.NOT_FOUND
        );
      }

      return assetHistData.totalIssuance;
    }

    if (poolType === PoolType.AAVE) {
      const aavepool = await this.dataSourceService.fetchAavepool({
        aTokenId: assetId,
      });

      if (!aavepool && this.appConfig.IGNORE_INVALID_ENTITIES) {
        this.logger.warn(`Aavepool with aToken ${assetId} not found`);
        return '0';
      } else if (!aavepool && !this.appConfig.IGNORE_INVALID_ENTITIES) {
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

      if (!aavepoolHistData && this.appConfig.IGNORE_INVALID_ENTITIES) {
        this.logger.warn(
          `Aavepool historical data for pool ${aavepool.id} at block ${blockHeight} not found`
        );
        return '0';
      } else if (!aavepoolHistData && !this.appConfig.IGNORE_INVALID_ENTITIES) {
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

    if (!accountAssetBalanceHistData && this.appConfig.IGNORE_INVALID_ENTITIES) {
      this.logger.warn('Account asset historical data not found');
      return '0';
    } else if (!accountAssetBalanceHistData && !this.appConfig.IGNORE_INVALID_ENTITIES) {
      throw new HttpException(
        BaseConsumerHelper.getErrorResponsePayload('Account asset historical data not found'),
        HttpStatus.NOT_FOUND
      );
    }

    return accountAssetBalanceHistData.transferable;
  }
}

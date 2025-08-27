import { Injectable } from '@nestjs/common';
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
import { DatasourceAsset, DatasourceBlock } from '../../../dataSource/graphqlSupport/types';
import { AssetEnhancementService } from '../../../dataSource/dataEnhancement/assets';

@Injectable()
export class DexScreenerTransformer extends BaseTransformer {
  constructor(
    private appConfig: AppConfig,
    private assetEnhancementService: AssetEnhancementService
  ) {
    super();
  }

  transformBlock(blockData: DatasourceBlock): DexScreenerLatestBlockResponse {
    this.logger.debug('Transforming latest block data for DEX Screener');

    const block: DexScreenerBlock = {
      blockNumber: blockData.height,
      blockTimestamp: Math.floor(new Date(blockData.timestamp).getTime() / 1000),
    };

    return { block };
  }

  transformAsset({ id, name, symbol, decimals }: DatasourceAsset): DexScreenerAssetResponse {
    this.logger.debug('Transforming asset data for DEX Screener');

    // Get enhancement data for this asset
    const enhancement = this.assetEnhancementService.getAssetEnhancement(id);

    const asset: DexScreenerAsset = {
      id,
      name,
      symbol,
      totalSupply: '0',
      circulatingSupply: '0',
      ...(enhancement?.coinGeckoId && { coinGeckoId: enhancement.coinGeckoId }),
      ...(enhancement?.coinMarketCapId && { coinMarketCapId: enhancement.coinMarketCapId }),
    };

    return { asset };
  }

  //
  // transformAsset(graphqlData: any): DexScreenerAssetResponse {
  //   this.logger.debug(`Transforming asset data for DEX Screener: ${graphqlData.asset?.id}`);
  //
  //   const assetData = graphqlData.asset;
  //
  //   const asset: DexScreenerAsset = {
  //     id: assetData.id,
  //     name: assetData.name,
  //     symbol: assetData.symbol,
  //     ...(assetData.totalSupply !== undefined && { totalSupply: assetData.totalSupply }),
  //     ...(assetData.circulatingSupply !== undefined && {
  //       circulatingSupply: assetData.circulatingSupply,
  //     }),
  //     ...(assetData.coinGeckoId && { coinGeckoId: assetData.coinGeckoId }),
  //     ...(assetData.coinMarketCapId && { coinMarketCapId: assetData.coinMarketCapId }),
  //     ...(assetData.metadata && { metadata: this.sanitizeMetadata(assetData.metadata) }),
  //   };
  //
  //   return { asset };
  // }
  //
  // transformPair(graphqlData: any): DexScreenerPairResponse {
  //   this.logger.debug(`Transforming pair data for DEX Screener: ${graphqlData.pair?.id}`);
  //
  //   const pairData = graphqlData.pair;
  //   const dexKey = this.appConfig.DEX_KEY;
  //
  //   const pair: DexScreenerPair = {
  //     id: pairData.id,
  //     dexKey,
  //     asset0Id: pairData.asset0?.id || pairData.asset0Id,
  //     asset1Id: pairData.asset1?.id || pairData.asset1Id,
  //     ...(pairData.createdAtBlockNumber !== undefined && {
  //       createdAtBlockNumber: pairData.createdAtBlockNumber,
  //     }),
  //     ...(pairData.createdAtTimestamp !== undefined && {
  //       createdAtBlockTimestamp: pairData.createdAtTimestamp,
  //     }),
  //     ...(pairData.createdAtTxnId && { createdAtTxnId: pairData.createdAtTxnId }),
  //     ...(pairData.creator && { creator: pairData.creator }),
  //     ...(pairData.feeBps !== undefined && { feeBps: pairData.feeBps }),
  //     ...(pairData.pool && { pool: pairData.pool }),
  //     ...(pairData.metadata && { metadata: this.sanitizeMetadata(pairData.metadata) }),
  //   };
  //
  //   return { pair };
  // }
  //
  // transformEvents(graphqlData: any): DexScreenerEventsResponse {
  //   this.logger.debug(
  //     `Transforming events data for DEX Screener, count: ${graphqlData.events?.length || 0}`
  //   );
  //
  //   const eventsData = graphqlData.events || [];
  //
  //   const events = eventsData.map((eventData: any) => {
  //     const block: DexScreenerBlock = {
  //       blockNumber: eventData.block.number || eventData.block.blockNumber,
  //       blockTimestamp: eventData.block.timestamp || eventData.block.blockTimestamp,
  //       ...(eventData.block.metadata && {
  //         metadata: this.sanitizeMetadata(eventData.block.metadata),
  //       }),
  //     };
  //
  //     let event: DexScreenerEvent;
  //
  //     if (eventData.eventType === 'swap') {
  //       event = this.transformSwapEvent(eventData);
  //     } else if (eventData.eventType === 'join' || eventData.eventType === 'exit') {
  //       event = this.transformJoinExitEvent(eventData);
  //     } else {
  //       throw new Error(`Unknown event type: ${eventData.eventType}`);
  //     }
  //
  //     return { block, ...event };
  //   });
  //
  //   return { events };
  // }
  //
  // private transformSwapEvent(eventData: any): DexScreenerSwapEvent {
  //   const swapEvent: DexScreenerSwapEvent = {
  //     eventType: 'swap',
  //     txnId: eventData.txnId,
  //     txnIndex: eventData.txnIndex,
  //     eventIndex: eventData.eventIndex,
  //     maker: eventData.maker,
  //     pairId: eventData.pairId,
  //     priceNative: eventData.priceNative,
  //     ...(eventData.asset0In !== undefined && { asset0In: eventData.asset0In }),
  //     ...(eventData.asset1In !== undefined && { asset1In: eventData.asset1In }),
  //     ...(eventData.asset0Out !== undefined && { asset0Out: eventData.asset0Out }),
  //     ...(eventData.asset1Out !== undefined && { asset1Out: eventData.asset1Out }),
  //     ...(eventData.reserves && { reserves: eventData.reserves }),
  //     ...(eventData.metadata && { metadata: this.sanitizeMetadata(eventData.metadata) }),
  //   };
  //
  //   return swapEvent;
  // }
  //
  // private transformJoinExitEvent(eventData: any): DexScreenerJoinExitEvent {
  //   const joinExitEvent: DexScreenerJoinExitEvent = {
  //     eventType: eventData.eventType,
  //     txnId: eventData.txnId,
  //     txnIndex: eventData.txnIndex,
  //     eventIndex: eventData.eventIndex,
  //     maker: eventData.maker,
  //     pairId: eventData.pairId,
  //     amount0: eventData.amount0,
  //     amount1: eventData.amount1,
  //     ...(eventData.reserves && { reserves: eventData.reserves }),
  //     ...(eventData.metadata && { metadata: this.sanitizeMetadata(eventData.metadata) }),
  //   };
  //
  //   return joinExitEvent;
  // }
}

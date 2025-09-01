// DEX Screener specific interfaces based on the specification

export enum DexScreenerEventType {
  SWAP = 'swap',
  JOIN = 'join',
  EXIT = 'exit',
}

export interface DexScreenerBlock {
  blockNumber: number;
  blockTimestamp: number;
  metadata?: Record<string, string>;
}

export interface DexScreenerAsset {
  id: string;
  name: string;
  symbol: string;
  totalSupply?: string | number;
  circulatingSupply?: string | number;
  coinGeckoId?: string;
  coinMarketCapId?: string;
  metadata?: Record<string, string>;
}

export interface DexScreenerPair {
  id: string;
  dexKey: string;
  asset0Id: string;
  asset1Id: string;
  createdAtBlockNumber?: number;
  createdAtBlockTimestamp?: number;
  createdAtTxnId?: string;
  creator?: string;
  feeBps?: number;
  pool?: {
    id: string;
    name: string;
    assetIds: string[];
    pairIds: string[];
    metadata?: Record<string, string>;
  };
  metadata?: Record<string, string>;
}

export interface DexScreenerSwapEvent {
  eventType: DexScreenerEventType;
  txnId: string;
  txnIndex: number;
  eventIndex: number;
  maker: string;
  pairId: string;
  asset0In?: number | string;
  asset1In?: number | string;
  asset0Out?: number | string;
  asset1Out?: number | string;
  priceNative: number | string;
  reserves?: {
    asset0: number | string;
    asset1: number | string;
  };
  metadata?: Record<string, string>;
}

export interface DexScreenerJoinExitEvent {
  eventType: DexScreenerEventType;
  txnId: string;
  txnIndex: number;
  eventIndex: number;
  maker: string;
  pairId: string;
  amount0: number | string;
  amount1: number | string;
  reserves?: {
    asset0: number | string;
    asset1: number | string;
  };
  metadata?: Record<string, string>;
}

export type DexScreenerEvent = DexScreenerSwapEvent | DexScreenerJoinExitEvent;

export type DexScreenerEventWithBlock = { block: DexScreenerBlock } & DexScreenerEvent;

// Response interfaces
export interface DexScreenerLatestBlockResponse {
  block: DexScreenerBlock;
}

export interface DexScreenerAssetResponse {
  asset: DexScreenerAsset;
}

export interface DexScreenerPairResponse {
  pair: DexScreenerPair;
}

export interface DexScreenerEventsResponse {
  events: Array<DexScreenerEventWithBlock>;
}

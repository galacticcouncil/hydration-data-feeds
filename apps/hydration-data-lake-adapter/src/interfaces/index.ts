// Block interface
export interface Block {
  blockNumber: number;
  blockTimestamp: number;
  metadata?: Record<string, string>;
}

// Asset interface
export interface Asset {
  id: string;
  name: string;
  symbol: string;
  totalSupply?: string | number;
  circulatingSupply?: string | number;
  coinGeckoId?: string;
  coinMarketCapId?: string;
  metadata?: Record<string, string>;
}

// Pair interface
export interface Pair {
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

// Swap Event interface
export interface SwapEvent {
  eventType: 'swap';
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

// Join/Exit Event interface
export interface JoinExitEvent {
  eventType: 'join' | 'exit';
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

// Event type union
export type Event = SwapEvent | JoinExitEvent;

// Response interfaces
export interface LatestBlockResponse {
  block: Block;
}

export interface AssetResponse {
  asset: Asset;
}

export interface PairResponse {
  pair: Pair;
}

export interface EventsResponse {
  events: Array<{ block: Block } & Event>;
}

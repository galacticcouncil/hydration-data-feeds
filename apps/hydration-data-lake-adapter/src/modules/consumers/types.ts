export enum ConsumerType {
  DEX_SCREENER = 'dexscreener',
  // Future consumers can be added here
  // COINGECKO = 'coingecko',
  // DEFILLAMA = 'defillama',
}

export enum ApiVersion {
  V1 = 'v1',
  V2 = 'v2',
}

export interface ConsumerConfig {
  type: ConsumerType;
  version: ApiVersion;
  enabled: boolean;
  basePath: string;
  description: string;
}

export interface BaseConsumerResponse {
  success: boolean;
  timestamp: string;
  data?: any;
  error?: string;
}

// Common data interfaces that can be extended by consumers
export interface BaseBlock {
  blockNumber: number;
  blockTimestamp: number;
  metadata?: Record<string, string>;
}

export interface BaseAsset {
  id: string;
  name: string;
  symbol: string;
  totalSupply?: string | number;
  circulatingSupply?: string | number;
  metadata?: Record<string, string>;
}

export interface BasePair {
  id: string;
  asset0Id: string;
  asset1Id: string;
  metadata?: Record<string, string>;
}

export interface BaseEvent {
  eventType: string;
  txnId: string;
  txnIndex: number;
  eventIndex: number;
  maker: string;
  pairId: string;
  metadata?: Record<string, string>;
}

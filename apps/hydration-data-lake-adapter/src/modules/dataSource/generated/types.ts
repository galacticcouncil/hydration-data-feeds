export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  BigDecimal: { input: string; output: string; }
  BigInt: { input: string; output: string; }
  DateTime: { input: string; output: string; }
  JSON: { input: any; output: any; }
};

export type Asset = {
  __typename?: 'Asset';
  circulatingSupply?: Maybe<Scalars['BigDecimal']['output']>;
  coinGeckoId?: Maybe<Scalars['String']['output']>;
  coinMarketCapId?: Maybe<Scalars['String']['output']>;
  decimals?: Maybe<Scalars['Int']['output']>;
  id: Scalars['String']['output'];
  metadata?: Maybe<Scalars['JSON']['output']>;
  name: Scalars['String']['output'];
  symbol: Scalars['String']['output'];
  totalSupply?: Maybe<Scalars['BigDecimal']['output']>;
};

export type Block = {
  __typename?: 'Block';
  hash?: Maybe<Scalars['String']['output']>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  number: Scalars['Int']['output'];
  timestamp: Scalars['DateTime']['output'];
};

export type Event = {
  block: Block;
  eventIndex: Scalars['Int']['output'];
  eventType: Scalars['String']['output'];
  maker: Scalars['String']['output'];
  metadata?: Maybe<Scalars['JSON']['output']>;
  pairId: Scalars['String']['output'];
  txnId: Scalars['String']['output'];
  txnIndex: Scalars['Int']['output'];
};

export type EventUnion = JoinExitEvent | SwapEvent;

export type EventsResponse = {
  __typename?: 'EventsResponse';
  data: Array<EventUnion>;
  totalCount: Scalars['Int']['output'];
};

export type JoinExitEvent = Event & {
  __typename?: 'JoinExitEvent';
  amount0: Scalars['BigDecimal']['output'];
  amount1: Scalars['BigDecimal']['output'];
  block: Block;
  eventIndex: Scalars['Int']['output'];
  eventType: Scalars['String']['output'];
  maker: Scalars['String']['output'];
  metadata?: Maybe<Scalars['JSON']['output']>;
  pairId: Scalars['String']['output'];
  reserves?: Maybe<Reserves>;
  txnId: Scalars['String']['output'];
  txnIndex: Scalars['Int']['output'];
};

export type Pair = {
  __typename?: 'Pair';
  asset0: Asset;
  asset1: Asset;
  createdAtBlockNumber?: Maybe<Scalars['Int']['output']>;
  createdAtTimestamp?: Maybe<Scalars['DateTime']['output']>;
  createdAtTxnId?: Maybe<Scalars['String']['output']>;
  creator?: Maybe<Scalars['String']['output']>;
  feeBps?: Maybe<Scalars['Int']['output']>;
  id: Scalars['String']['output'];
  metadata?: Maybe<Scalars['JSON']['output']>;
  pool?: Maybe<Pool>;
  reserves?: Maybe<Reserves>;
};

export type Pool = {
  __typename?: 'Pool';
  assetIds: Array<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  metadata?: Maybe<Scalars['JSON']['output']>;
  name: Scalars['String']['output'];
  pairIds: Array<Scalars['String']['output']>;
};

export type Query = {
  __typename?: 'Query';
  asset?: Maybe<Asset>;
  assets: Array<Asset>;
  block?: Maybe<Block>;
  events: EventsResponse;
  latestBlock?: Maybe<Block>;
  pair?: Maybe<Pair>;
  pairs: Array<Pair>;
  swapEvents: SwapEventsResponse;
};


export type QueryAssetArgs = {
  id: Scalars['String']['input'];
};


export type QueryAssetsArgs = {
  ids: Array<Scalars['String']['input']>;
};


export type QueryBlockArgs = {
  number: Scalars['Int']['input'];
};


export type QueryEventsArgs = {
  fromBlock: Scalars['Int']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  toBlock: Scalars['Int']['input'];
};


export type QueryPairArgs = {
  id: Scalars['String']['input'];
};


export type QueryPairsArgs = {
  ids: Array<Scalars['String']['input']>;
};


export type QuerySwapEventsArgs = {
  fromBlock: Scalars['Int']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  pairIds?: InputMaybe<Array<Scalars['String']['input']>>;
  toBlock: Scalars['Int']['input'];
};

export type Reserves = {
  __typename?: 'Reserves';
  asset0: Scalars['BigDecimal']['output'];
  asset1: Scalars['BigDecimal']['output'];
};

export type SwapEvent = Event & {
  __typename?: 'SwapEvent';
  asset0In?: Maybe<Scalars['BigDecimal']['output']>;
  asset0Out?: Maybe<Scalars['BigDecimal']['output']>;
  asset1In?: Maybe<Scalars['BigDecimal']['output']>;
  asset1Out?: Maybe<Scalars['BigDecimal']['output']>;
  block: Block;
  eventIndex: Scalars['Int']['output'];
  eventType: Scalars['String']['output'];
  maker: Scalars['String']['output'];
  metadata?: Maybe<Scalars['JSON']['output']>;
  pairId: Scalars['String']['output'];
  priceNative: Scalars['BigDecimal']['output'];
  reserves?: Maybe<Reserves>;
  txnId: Scalars['String']['output'];
  txnIndex: Scalars['Int']['output'];
};

export type SwapEventsResponse = {
  __typename?: 'SwapEventsResponse';
  data: Array<SwapEvent>;
  totalCount: Scalars['Int']['output'];
};

export type GetAssetQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetAssetQuery = { __typename?: 'Query', asset?: { __typename?: 'Asset', id: string, name: string, symbol: string, totalSupply?: string | null, circulatingSupply?: string | null, decimals?: number | null, coinGeckoId?: string | null, coinMarketCapId?: string | null, metadata?: any | null } | null };

export type GetAssetsQueryVariables = Exact<{
  ids: Array<Scalars['String']['input']> | Scalars['String']['input'];
}>;


export type GetAssetsQuery = { __typename?: 'Query', assets: Array<{ __typename?: 'Asset', id: string, name: string, symbol: string, totalSupply?: string | null, circulatingSupply?: string | null, decimals?: number | null, coinGeckoId?: string | null, coinMarketCapId?: string | null, metadata?: any | null }> };

export type GetLatestBlockQueryVariables = Exact<{ [key: string]: never; }>;


export type GetLatestBlockQuery = { __typename?: 'Query', latestBlock?: { __typename?: 'Block', number: number, timestamp: string, hash?: string | null, metadata?: any | null } | null };

export type GetBlockByNumberQueryVariables = Exact<{
  blockNumber: Scalars['Int']['input'];
}>;


export type GetBlockByNumberQuery = { __typename?: 'Query', block?: { __typename?: 'Block', number: number, timestamp: string, hash?: string | null, metadata?: any | null } | null };

export type GetEventsQueryVariables = Exact<{
  fromBlock: Scalars['Int']['input'];
  toBlock: Scalars['Int']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetEventsQuery = { __typename?: 'Query', events: { __typename?: 'EventsResponse', totalCount: number, data: Array<{ __typename?: 'JoinExitEvent', eventType: string, txnId: string, txnIndex: number, eventIndex: number, maker: string, pairId: string, amount0: string, amount1: string, metadata?: any | null, block: { __typename?: 'Block', number: number, timestamp: string, hash?: string | null, metadata?: any | null }, reserves?: { __typename?: 'Reserves', asset0: string, asset1: string } | null } | { __typename?: 'SwapEvent', eventType: string, txnId: string, txnIndex: number, eventIndex: number, maker: string, pairId: string, asset0In?: string | null, asset1In?: string | null, asset0Out?: string | null, asset1Out?: string | null, priceNative: string, metadata?: any | null, block: { __typename?: 'Block', number: number, timestamp: string, hash?: string | null, metadata?: any | null }, reserves?: { __typename?: 'Reserves', asset0: string, asset1: string } | null }> } };

export type GetSwapEventsQueryVariables = Exact<{
  fromBlock: Scalars['Int']['input'];
  toBlock: Scalars['Int']['input'];
  pairIds?: InputMaybe<Array<Scalars['String']['input']> | Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetSwapEventsQuery = { __typename?: 'Query', swapEvents: { __typename?: 'SwapEventsResponse', totalCount: number, data: Array<{ __typename?: 'SwapEvent', eventType: string, txnId: string, txnIndex: number, eventIndex: number, maker: string, pairId: string, asset0In?: string | null, asset1In?: string | null, asset0Out?: string | null, asset1Out?: string | null, priceNative: string, metadata?: any | null, block: { __typename?: 'Block', number: number, timestamp: string, hash?: string | null }, reserves?: { __typename?: 'Reserves', asset0: string, asset1: string } | null }> } };

export type GetPairQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetPairQuery = { __typename?: 'Query', pair?: { __typename?: 'Pair', id: string, createdAtBlockNumber?: number | null, createdAtTimestamp?: string | null, createdAtTxnId?: string | null, creator?: string | null, feeBps?: number | null, metadata?: any | null, asset0: { __typename?: 'Asset', id: string, name: string, symbol: string }, asset1: { __typename?: 'Asset', id: string, name: string, symbol: string }, reserves?: { __typename?: 'Reserves', asset0: string, asset1: string } | null, pool?: { __typename?: 'Pool', id: string, name: string, assetIds: Array<string>, pairIds: Array<string>, metadata?: any | null } | null } | null };

export type GetPairsQueryVariables = Exact<{
  ids: Array<Scalars['String']['input']> | Scalars['String']['input'];
}>;


export type GetPairsQuery = { __typename?: 'Query', pairs: Array<{ __typename?: 'Pair', id: string, createdAtBlockNumber?: number | null, createdAtTimestamp?: string | null, createdAtTxnId?: string | null, creator?: string | null, feeBps?: number | null, metadata?: any | null, asset0: { __typename?: 'Asset', id: string, name: string, symbol: string }, asset1: { __typename?: 'Asset', id: string, name: string, symbol: string }, reserves?: { __typename?: 'Reserves', asset0: string, asset1: string } | null, pool?: { __typename?: 'Pool', id: string, name: string, assetIds: Array<string>, pairIds: Array<string>, metadata?: any | null } | null }> };

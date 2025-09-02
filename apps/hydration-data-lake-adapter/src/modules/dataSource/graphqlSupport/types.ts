import {
  Block,
  Asset,
  Swap,
  AssetHistoricalDatum,
  AccountAssetBalanceHistoricalDatum,
  Aavepool,
  AavepoolHistoricalDatum,
} from './mainIndexer/apiTypes';

export type DatasourceBlock = Pick<Block, 'id' | 'height' | 'hash' | 'timestamp'>;

export type DatasourceAsset = Pick<Asset, 'id' | 'symbol' | 'name' | 'decimals' | 'assetType'>;

export type DatasourceAssetHistoricalData = Pick<
  AssetHistoricalDatum,
  'assetId' | 'totalIssuance' | 'paraBlockHeight'
>;

export type DatasourceAccountAssetBalanceHistoricalData = Pick<
  AccountAssetBalanceHistoricalDatum,
  'id' | 'assetId' | 'paraBlockHeight' | 'transferable'
>;

export type DatasourceSwap = Pick<
  Swap,
  | 'id'
  | 'routedTradeId'
  | 'swapIndex'
  | 'event'
  | 'fillerType'
  | 'fillerId'
  | 'swapperId'
  | 'dcaScheduleExecutionEventId'
  | 'otcOrderFulfillmentId'
  | 'dcaScheduleExecutionEvent'
  | 'otcOrderFulfillment'
  | 'swapInputs'
  | 'swapOutputs'
  | 'paraBlockHeight'
>;

export type DatasourceAavepool = Pick<
  Aavepool,
  'id' | 'aTokenId' | 'reserveAssetId' | 'moneyMarketReserveId'
>;

export type DatasourceAavepoolHistoricalData = Pick<
  AavepoolHistoricalDatum,
  'id' | 'liquidityIn' | 'aTokenTotalSupply' | 'paraBlockHeight'
>;

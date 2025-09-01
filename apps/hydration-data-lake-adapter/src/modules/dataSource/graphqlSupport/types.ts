import { Block, Asset, Swap } from './mainIndexer/apiTypes';

export type DatasourceBlock = Pick<Block, 'id' | 'height' | 'hash' | 'timestamp'>;

export type DatasourceAsset = Pick<Asset, 'id' | 'symbol' | 'name' | 'decimals'>;

export type DatasourceSwap = Pick<
  Swap,
  | 'id'
  | 'routedTradeId'
  | 'swapIndex'
  | 'event'
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

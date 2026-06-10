import {
  Block,
  Asset,
  Swap,
  AssetHistoricalDatum,
  AccountAssetBalanceHistoricalDatum,
  Aavepool,
  AavepoolHistoricalDatum,
  Account,
  GetAavepoolHistDataAtBlockQuery,
  GetSwapsInBlocksRangeQuery,
  GetAssetByIdQuery,
  GetBlockByHeightQuery,
  GetAssetHistDataAtBlockQuery,
  GetAccountAssetBalanceHistDataAtBlockQuery,
  GetAavepoolQuery,
  GetPoolByAccountQuery
} from './mainIndexer/apiTypes';

export type DatasourceBlock = GetBlockByHeightQuery['blocks']['nodes'][number];

export type DatasourceAsset = GetAssetByIdQuery['asset'];

export type DatasourceAssetHistoricalData =
  GetAssetHistDataAtBlockQuery['assetHistoricalData']['nodes'][number];

export type DatasourceAccountAssetBalanceHistoricalData =
  GetAccountAssetBalanceHistDataAtBlockQuery['accountAssetBalanceHistoricalData']['nodes'][number];

export type DatasourceSwap = GetSwapsInBlocksRangeQuery['swaps']['nodes'][number];

export type DatasourceAavepool = GetAavepoolQuery['aavepools']['nodes'][number];

export type DatasourceAavepoolHistoricalData =
  GetAavepoolHistDataAtBlockQuery['aavepoolHistoricalData']['nodes'][number];

export type DatasourceAccountData = GetPoolByAccountQuery['accounts']['nodes'][number];

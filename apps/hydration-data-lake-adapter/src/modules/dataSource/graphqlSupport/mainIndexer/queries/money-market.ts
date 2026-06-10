import gql from 'graphql-tag';
import {
  AavepoolFilter,
  AavepoolHistoricalDataOrderBy,
  AavepoolHistoricalDatumFilter,
  MoneyMarketReserveFilter,
} from '../apiTypes';

export const GET_MM_RESERVE_BY_ATOKEN_ID = gql`
  query GetMmReserveByAtokenId($filter: MoneyMarketReserveFilter) {
    moneyMarketReserves(filter: $filter) {
      nodes {
        id
        aavePoolId
      }
    }
  }
`;
export const GET_AAVEPOOL = gql`
  query GetAavepool($filter: AavepoolFilter) {
    aavepools(filter: $filter) {
      nodes {
        id
        aTokenId
        reserveAssetId
        moneyMarketReserveId
      }
    }
  }
`;

export const GET_AAVEPOOL_HIST_DATA_AT_BLOCK = gql`
  query GetAavepoolHistDataAtBlock(
    $first: Int!
    $filter: AavepoolHistoricalDatumFilter
    $orderBy: [AavepoolHistoricalDataOrderBy!]
  ) {
    aavepoolHistoricalData(first: $first, orderBy: $orderBy, filter: $filter) {
      nodes {
        id
        liquidityIn
        paraBlockHeight
        aTokenTotalSupply
      }
    }
  }
`;

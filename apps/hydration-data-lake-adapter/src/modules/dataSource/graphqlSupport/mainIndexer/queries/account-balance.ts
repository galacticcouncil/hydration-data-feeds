import gql from 'graphql-tag';
import {
  AccountAssetBalanceHistoricalDataOrderBy,
  AccountAssetBalanceHistoricalDatumFilter,
} from '../apiTypes';

export const GET_ACCOUNT_ASSET_BALANCE_HIST_DATA_AT_BLOCK = gql`
  query GetAccountAssetBalanceHistDataAtBlock(
    $first: Int!
    $filter: AccountAssetBalanceHistoricalDatumFilter
    $orderBy: [AccountAssetBalanceHistoricalDataOrderBy!]
  ) {
    accountAssetBalanceHistoricalData(first: $first, orderBy: $orderBy, filter: $filter) {
      nodes {
        id
        assetId
        transferable
        paraBlockHeight
      }
    }
  }
`;

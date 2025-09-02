import gql from 'graphql-tag';
import {
  EventFilter,
  EventsOrderBy,
  AssetHistoricalDataOrderBy,
  AssetHistoricalDatumFilter,
} from '../apiTypes';

export const GET_ASSET_BY_ID = gql`
  query GetAssetById($id: String!) {
    asset(id: $id) {
      id
      name
      symbol
      decimals
      assetType
    }
  }
`;

export const GET_ASSET_HIST_DATA_AT_BLOCK = gql`
  query GetAssetHistDataAtBlock(
    $first: Int!
    $filter: AssetHistoricalDatumFilter
    $orderBy: [AssetHistoricalDataOrderBy!]
  ) {
    assetHistoricalData(first: $first, orderBy: $orderBy, filter: $filter) {
      nodes {
        assetId
        paraBlockHeight
        totalIssuance
      }
    }
  }
`;

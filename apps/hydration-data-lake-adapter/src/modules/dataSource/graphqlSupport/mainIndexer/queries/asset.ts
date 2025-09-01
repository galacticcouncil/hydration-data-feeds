import gql from 'graphql-tag';
import { EventFilter, EventsOrderBy } from '../apiTypes';

export const GET_ASSET_BY_ID = gql`
  query GetAssetById($id: String!) {
    asset(id: $id) {
      id
      name
      symbol
      decimals
    }
  }
`;

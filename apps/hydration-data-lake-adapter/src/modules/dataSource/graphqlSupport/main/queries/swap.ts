import gql from 'graphql-tag';
import { EventFilter, EventsOrderBy, SwapsOrderBy } from '../apiTypes';

export const GET_LATEST_SWAP_WITH_BLOCK = gql`
  query GetLatestSwapWithBlock($first: Int!, $orderBy: [SwapsOrderBy!]) {
    swaps(first: $first, orderBy: $orderBy) {
      nodes {
        id
        event {
          block {
            id
            height
            hash
            timestamp
          }
        }
      }
    }
  }
`;

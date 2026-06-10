import gql from 'graphql-tag';
import { EventFilter, EventsOrderBy, BlockFilter } from '../apiTypes';

export const GET_LATEST_PROCESSED_BLOCK_ENSURED_BY_EVENTS = gql`
  query GetLatestProcessedBlockEnsuredByEvents(
    $first: Int!
    $orderBy: [EventsOrderBy!]
    $filter: EventFilter
  ) {
    events(first: $first, orderBy: $orderBy, filter: $filter) {
      nodes {
        block {
          id
          height
          hash
          timestamp
        }
      }
    }
  }
`;

export const GET_BLOCK_BY_HEIGHT = gql`
  query GetBlockByHeight($filter: BlockFilter) {
    blocks(filter: $filter) {
      nodes {
        id
        height
        hash
        timestamp
      }
    }
  }
`;

import gql from 'graphql-tag';
import { EventFilter, EventsOrderBy } from '../apiTypes';

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

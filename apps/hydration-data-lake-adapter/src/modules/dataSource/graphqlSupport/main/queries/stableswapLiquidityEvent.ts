import gql from 'graphql-tag';
import {
  EventFilter,
  EventsOrderBy,
  StableswapLiquidityEventsOrderBy,
  SwapsOrderBy,
} from '../apiTypes';

export const GET_LATEST_STABLESWAP_LIQUIDITY_EVENT_WITH_BLOCK = gql`
  query GetLatestStableswapLiquidityEventWithBlock(
    $first: Int!
    $orderBy: [StableswapLiquidityEventsOrderBy!]
  ) {
    stableswapLiquidityEvents(first: $first, orderBy: $orderBy) {
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

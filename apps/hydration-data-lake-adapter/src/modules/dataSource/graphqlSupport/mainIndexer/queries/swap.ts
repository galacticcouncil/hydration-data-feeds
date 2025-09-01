import gql from 'graphql-tag';
import { EventFilter, EventsOrderBy, SwapFilter, SwapsOrderBy } from '../apiTypes';

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

export const GET_SWAPS_IN_BLOCKS_RANGE = gql`
  query GetSwapsInBlocksRange(
    $first: Int!
    $offset: Int!
    $filter: SwapFilter
    $orderBy: [SwapsOrderBy!]
  ) {
    swaps(first: $first, orderBy: $orderBy, filter: $filter, offset: $offset) {
      totalCount
      nodes {
        id
        paraBlockHeight
        routedTradeId
        swapIndex
        event {
          indexInBlock
          traceId
          call {
            originValue
            originValueKind
          }
        }
        fillerId
        swapperId
        dcaScheduleExecutionEventId
        otcOrderFulfillmentId
        dcaScheduleExecutionEvent {
          scheduleExecution {
            schedule {
              ownerId
            }
          }
        }
        otcOrderFulfillment {
          order {
            ownerId
          }
        }
        swapInputs {
          nodes {
            amount
            asset {
              id
              decimals
            }
          }
        }
        swapOutputs {
          nodes {
            amount
            asset {
              id
              decimals
            }
          }
        }
      }
    }
  }
`;

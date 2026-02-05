import { gql } from 'graphql-tag';

/**
 * Query to fetch liquidation events with minimal data
 * Only fetches essential fields needed for fee tracking:
 * - eventId: for temporal ordering
 * - paraBlockHeight: to query transfers
 * - liquidationCallId: for reference/debugging
 *
 * Note: paraTimestamp doesn't exist in moneyMarketEvents.
 * We'll get the timestamp from the transfers table instead.
 */
export const GET_LIQUIDATION_EVENTS_QUERY = gql`
  query GetLiquidationEvents($fromBlock: Int!, $first: Int!) {
    moneyMarketEvents(
      filter: {
        liquidationCallId: { isNull: false }
        paraBlockHeight: { greaterThan: $fromBlock }
      }
      first: $first
      orderBy: PARA_BLOCK_HEIGHT_ASC
    ) {
      totalCount
      nodes {
        eventId
        paraBlockHeight
        liquidationCallId
      }
    }
  }
`;

/**
 * Query to fetch treasury transfers directly from transfers table
 * Applies all filters server-side for maximum efficiency:
 * - Block heights via IN operator (batch query)
 * - Treasury address filter (toId includes)
 * - Zero address exclusion (fromId not equal to)
 *
 * Note: We fetch paraTimestamp here since it exists in transfers but not in moneyMarketEvents
 */
export const GET_TREASURY_TRANSFERS_QUERY = gql`
  query GetTreasuryTransfers(
    $blockHeights: [Int!]!
    $treasuryAddress: String!
    $zeroAddress: String!
  ) {
    transfers(
      filter: {
        paraBlockHeight: { in: $blockHeights }
        toId: { includes: $treasuryAddress }
        fromId: { notEqualTo: $zeroAddress }
      }
      orderBy: [PARA_BLOCK_HEIGHT_ASC, EVENT_ID_ASC]
    ) {
      totalCount
      nodes {
        eventId
        paraBlockHeight
        paraTimestamp
        fromId
        toId
        assetId
        amount
      }
    }
  }
`;

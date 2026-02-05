import { gql } from 'graphql-tag';

/**
 * Query to fetch Aave Facilitator historical data using pagination
 *
 * Strategy: Pagination-based fetching (matches PEPL pattern)
 * 1. Filter paraBlockHeight > lastProcessedBlock
 * 2. Order by paraBlockHeight ASC, id ASC
 * 3. Use first: N to limit batch size (100 records)
 */
export const GET_AAVE_FACILITATOR_HISTORICAL_DATA_QUERY = gql`
  query GetAaveFacilitatorHistoricalData($facilitatorId: String!, $fromBlock: Int!, $first: Int!) {
    aaveFacilitatorHistoricalData(
      filter: {
        paraBlockHeight: { greaterThan: $fromBlock }
        facilitatorId: { equalTo: $facilitatorId }
      }
      orderBy: [PARA_BLOCK_HEIGHT_ASC, ID_ASC]
      first: $first
    ) {
      totalCount
      nodes {
        id
        bucketLevel
        paraBlockHeight
        paraTimestamp
      }
    }
  }
`;

/**
 * Query to fetch Account Total Balance for multiple block heights
 *
 * Strategy: Single query with IN operator for batch efficiency
 * - Filter: accountId (constant) AND paraBlockHeight IN [blocks...]
 * - Returns totalTransferableNorm (already normalized) for all blocks
 * - Much more efficient than querying each block individually
 */
export const GET_ACCOUNT_TOTAL_BALANCE_HISTORICAL_DATA_QUERY = gql`
  query GetAccountTotalBalanceHistoricalData(
    $accountId: String!
    $blockHeights: [Int!]!
  ) {
    accountTotalBalanceHistoricalData(
      filter: {
        accountId: { equalTo: $accountId }
        paraBlockHeight: { in: $blockHeights }
      }
    ) {
      totalCount
      nodes {
        paraBlockHeight
        totalTransferableNorm
      }
    }
  }
`;

/**
 * Fallback query to fetch the most recent Account Total Balance at or before a specific block
 *
 * Strategy: Fetch most recent balance when exact match not found
 * - Filter: accountId (constant) AND paraBlockHeight <= targetBlock
 * - Order by paraBlockHeight DESC to get most recent
 * - Limit to 1 result
 */
export const GET_MOST_RECENT_ACCOUNT_BALANCE_QUERY = gql`
  query GetMostRecentAccountBalance(
    $accountId: String!
    $maxBlockHeight: Int!
  ) {
    accountTotalBalanceHistoricalData(
      filter: {
        accountId: { equalTo: $accountId }
        paraBlockHeight: { lessThanOrEqualTo: $maxBlockHeight }
      }
      orderBy: PARA_BLOCK_HEIGHT_DESC
      first: 1
    ) {
      totalCount
      nodes {
        paraBlockHeight
        totalTransferableNorm
      }
    }
  }
`;

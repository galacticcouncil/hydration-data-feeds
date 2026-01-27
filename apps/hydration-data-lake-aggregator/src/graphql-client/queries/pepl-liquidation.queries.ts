import { gql } from 'graphql-tag';

/**
 * Query to fetch PEPL liquidation events using pagination
 *
 * Strategy: Instead of filtering by block range, we:
 * 1. Filter paraBlockHeight > lastProcessedBlock (from state)
 * 2. Order by paraBlockHeight ASC
 * 3. Use first: N to limit batch size
 * 4. Each batch processes 500 records at a time
 *
 * This is more efficient because:
 * - No need to calculate toBlock range
 * - Database can use index on paraBlockHeight efficiently
 * - Ordered results guarantee sequential processing
 *
 * Fields structure:
 * - paraBlockHeight: Can be filtered directly (no need for nested event.block)
 * - event.block.timestamp: Accessed via event for timestamp
 */
export const GET_PEPL_LIQUIDATION_EVENTS_QUERY = gql`
  query GetPeplLiquidationEvents($fromBlock: Int!, $first: Int!) {
    liquidationLiquidatedEvents(
      filter: {
        paraBlockHeight: { greaterThan: $fromBlock }
      }
      orderBy: [PARA_BLOCK_HEIGHT_ASC, ID_ASC]
      first: $first
    ) {
      totalCount
      nodes {
        id
        collateralAssetId
        debtAssetId
        profit
        paraBlockHeight
        eventId
        event {
          id
          block {
            timestamp
          }
        }
      }
    }
  }
`;

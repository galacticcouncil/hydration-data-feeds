import { gql } from 'graphql-tag';

/**
 * Query to fetch Asset Reserve events (mmMintedToTreasuryEvents) using pagination
 *
 * Strategy: Pagination-based fetching for efficiency
 * 1. Filter paraBlockHeight > lastProcessedBlock (from state)
 * 2. Order by paraBlockHeight ASC, id ASC
 * 3. Use first: N to limit batch size
 * 4. Each batch processes 500 records at a time
 *
 * This is efficient because:
 * - No need to calculate toBlock range
 * - Database can use index on paraBlockHeight efficiently
 * - Ordered results guarantee sequential processing
 *
 * Fields structure:
 * - amount: Raw amount needing normalization
 * - assetId: For decimal lookup and price enrichment
 * - paraBlockHeight: For state tracking and pagination
 * - event.block.timestamp: For time-series bucketing
 * - id: Event identifier
 * - eventId: Event reference
 * - totalCount: For pagination tracking
 */
export const GET_ASSET_RESERVE_EVENTS_QUERY = gql`
  query GetAssetReserveEvents($fromBlock: Int!, $first: Int!) {
    mmMintedToTreasuryEvents(
      filter: {
        paraBlockHeight: { greaterThan: $fromBlock }
      }
      orderBy: [PARA_BLOCK_HEIGHT_ASC, ID_ASC]
      first: $first
    ) {
      totalCount
      nodes {
        id
        assetId
        amount
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

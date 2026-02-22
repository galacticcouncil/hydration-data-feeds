import { gql } from 'graphql-tag';

/**
 * Query to fetch Borrow APR transfers using block-based pagination
 *
 * Strategy: Pagination-based fetching (matches existing patterns in codebase)
 * 1. Filter paraBlockHeight > lastProcessedBlock (from state)
 * 2. Filter toId includes the treasury address (case-insensitive)
 * 3. Filter assetId matches the Borrow APR asset
 * 4. Order by paraBlockHeight ASC, eventId ASC
 * 5. Use first: N to limit batch size
 *
 * Address: 0x8C0f3b9602374198974d2B2679d14a386f5b108e (Borrow APR treasury)
 * Asset: 0x531a654d1696ed52e7275a8cede955e82620f99a (Borrow APR asset)
 */
export const GET_BORROW_APR_TRANSFERS_QUERY = gql`
  query GetBorrowAprTransfers($fromBlock: Int!, $toBlock: Int!, $first: Int!) {
    transfers(
      filter: {
        toId: { includesInsensitive: "8C0f3b9602374198974d2B2679d14a386f5b108e" }
        assetId: { equalTo: "0x531a654d1696ed52e7275a8cede955e82620f99a" }
        paraBlockHeight: { greaterThan: $fromBlock, lessThanOrEqualTo: $toBlock }
      }
      orderBy: [PARA_BLOCK_HEIGHT_ASC, EVENT_ID_ASC]
      first: $first
    ) {
      totalCount
      nodes {
        amount
        assetId
        assetType
        eventId
        paraBlockHeight
        paraTimestamp
        toId
      }
    }
  }
`;

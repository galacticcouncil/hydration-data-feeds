import { gql } from 'graphql-tag';

/**
 * Query to fetch Borrow APR transfers (both incoming and outgoing)
 *
 * Strategy: Bidirectional net flow tracking
 * 1. Incoming: Transfers TO treasury address (positive contribution)
 * 2. Outgoing: Transfers FROM treasury TO zero address (negative contribution)
 * 3. Net Borrow APR = SUM(incoming) - SUM(outgoing)
 *
 * Filters:
 * - assetId matches Borrow APR asset
 * - paraBlockHeight within query range
 * - OR condition:
 *   a) toId includes treasury (incoming)
 *   b) fromId includes treasury AND toId includes zero address (outgoing)
 *
 * Treasury: 0x8C0f3b9602374198974d2B2679d14a386f5b108e
 * Zero Address: 0x0000000000000000000000000000000000000000000000000000000000000000
 * Asset: 0x531a654d1696ed52e7275a8cede955e82620f99a
 */
export const GET_BORROW_APR_TRANSFERS_QUERY = gql`
  query GetBorrowAprTransfers($fromBlock: Int!, $toBlock: Int!, $first: Int!) {
    transfers(
      filter: {
        assetId: { equalTo: "0x531a654d1696ed52e7275a8cede955e82620f99a" }
        paraBlockHeight: { greaterThan: $fromBlock, lessThanOrEqualTo: $toBlock }
        or: [
          { toId: { includesInsensitive: "8C0f3b9602374198974d2B2679d14a386f5b108e" } }
          {
            fromId: { includesInsensitive: "8C0f3b9602374198974d2B2679d14a386f5b108e" }
            toId: { includesInsensitive: "0000000000000000000000000000000000000000000000000000000000000000" }
          }
        ]
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
        fromId
      }
    }
  }
`;

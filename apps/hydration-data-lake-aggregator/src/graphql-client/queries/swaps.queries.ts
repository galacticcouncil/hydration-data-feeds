import { gql } from 'graphql-tag';

/**
 * Query to fetch Omnipool swaps within a block range
 * Based on the actual Hydration GraphQL schema
 */
export const GET_SWAPS_QUERY = gql`
  query GetSwaps($fromBlock: Int!, $toBlock: Int!, $first: Int!) {
    swaps(
      condition: { fillerType: "Omnipool" }
      filter: {
        paraBlockHeight: { lessThan: $toBlock, greaterThanOrEqualTo: $fromBlock }
      }
      first: $first
      orderBy: PARA_BLOCK_HEIGHT_ASC
    ) {
      totalCount
      nodes {
        id
        paraBlockHeight
        paraTimestamp
        fillerId
        fillerType
        swapFees {
          nodes {
            id
            amount
            assetId
            destinationType
            recipientId
            asset {
              decimals
            }
          }
        }
      }
    }
  }
`;

/**
 * Query to fetch asset spot prices at a specific block height
 * This will be used to get USD prices for fee calculation
 */
export const GET_ASSET_PRICES_AT_BLOCK_QUERY = gql`
  query GetAssetPricesAtBlock($assetIds: [String!]!, $blockHeight: Int!) {
    assetSpotPriceHistoricalData(
      filter: {
        assetInAssetRegistryId: { in: $assetIds }
        paraBlockHeight: { equalTo: $blockHeight }
      }
    ) {
      nodes {
        assetInAssetRegistryId
        assetOutAssetRegistryId
        paraBlockHeight
        price
        priceNormalised
      }
    }
  }
`;

/**
 * Query to fetch latest asset spot prices
 * For real-time price lookups
 */
export const GET_LATEST_ASSET_PRICES_QUERY = gql`
  query GetLatestAssetPrices($assetIds: [String!]!) {
    assetSpotPriceHistoricalData(
      filter: { assetInAssetRegistryId: { in: $assetIds } }
      orderBy: PARA_BLOCK_HEIGHT_DESC
      first: 100
    ) {
      nodes {
        assetInAssetRegistryId
        assetOutAssetRegistryId
        paraBlockHeight
        price
        priceNormalised
      }
    }
  }
`;

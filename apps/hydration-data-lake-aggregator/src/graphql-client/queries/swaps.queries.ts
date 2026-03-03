import { gql } from 'graphql-tag';

/**
 * Query to fetch Omnipool swaps within a block range
 * Based on the actual Hydration GraphQL schema
 * Note: Asset decimals are fetched separately via AssetRegistryService
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
        assetInId: { in: $assetIds }
        paraBlockHeight: { equalTo: $blockHeight }
      }
    ) {
      totalCount
      nodes {
        assetInId
        assetOutId
        paraBlockHeight
        price
        priceNormalised
      }
    }
  }
`;

/**
 * Query to fetch nearest historical asset spot prices for a given block height
 * Uses lessThanOrEqualTo filter to get the most recent price at or before the target block
 * This handles sparse price data where prices only update when they change
 *
 * Note: first: 500 ensures we get prices for all assets even when some assets
 * have many historical price updates. With ~15 assets per query, this gives
 * ~33 price records per asset on average, ensuring at least one price per asset.
 */
export const GET_NEAREST_ASSET_PRICES_QUERY = gql`
  query GetNearestAssetPrices($assetIds: [String!]!, $blockHeight: Int!) {
    assetSpotPriceHistoricalData(
      filter: {
        assetInId: { in: $assetIds }
        paraBlockHeight: { lessThanOrEqualTo: $blockHeight }
      }
      orderBy: PARA_BLOCK_HEIGHT_DESC
      first: 500
    ) {
      totalCount
      nodes {
        assetInId
        assetOutId
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
      filter: { assetInId: { in: $assetIds } }
      orderBy: PARA_BLOCK_HEIGHT_DESC
      first: 100
    ) {
      totalCount
      nodes {
        assetInId
        assetOutId
        paraBlockHeight
        price
        priceNormalised
      }
    }
  }
`;

/**
 * Query to fetch all assets with their decimals
 * Used to populate the asset registry cache
 */
export const GET_ALL_ASSETS_QUERY = gql`
  query GetAllAssets {
    assets {
      totalCount
      nodes {
        id
        decimals
      }
    }
  }
`;

/**
 * Query to fetch Omnipool routed trades within a block range
 * Used for blocks >= OMNIPOOL_RUNTIME_UPGRADE_BLOCK (11394694)
 * RoutedTrades group multiple swaps from a single user transaction
 * Includes swap inputs/outputs for H2O special case handling
 *
 * Note: We filter for Omnipool at the swap level using the filter parameter
 */
export const GET_ROUTED_TRADES_QUERY = gql`
  query GetRoutedTrades($fromBlock: Int!, $toBlock: Int!, $first: Int!) {
    routedTrades(
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
        inputAssetIds
        outputAssetIds
        swaps(filter: { fillerType: { equalTo: "Omnipool" } }) {
          nodes {
            id
            operationId
            paraTimestamp
            fillerId
            fillerType
            swapInputs {
              nodes {
                assetId
                amount
              }
            }
            swapOutputs {
              nodes {
                assetId
                amount
              }
            }
            swapFees {
              nodes {
                id
                amount
                assetId
                destinationType
                recipientId
              }
            }
          }
        }
      }
    }
  }
`;

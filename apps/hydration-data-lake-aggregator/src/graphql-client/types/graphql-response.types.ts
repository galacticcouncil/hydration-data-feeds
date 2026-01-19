/**
 * GraphQL response types based on actual Hydration schema
 */

export interface SwapFeeNode {
  id: string;
  amount: string;
  assetId: string;
  destinationType: string;
  recipientId: string;
  asset: {
    decimals: number;
  };
}

export interface SwapFeesConnection {
  nodes: SwapFeeNode[];
}

export interface SwapNode {
  id: string;
  paraBlockHeight: number;
  paraTimestamp: string; // ISO8601 timestamp
  fillerId: string;
  fillerType: string; // "Omnipool"
  swapFees: SwapFeesConnection;
}

export interface SwapsConnection {
  totalCount: number;
  nodes: SwapNode[];
}

export interface GetSwapsResponse {
  swaps: SwapsConnection;
}

export interface AssetSpotPriceNode {
  assetInAssetRegistryId: string;
  assetOutAssetRegistryId: string;
  paraBlockHeight: number;
  price: string; // Raw price value
  priceNormalised: string; // Normalized price (human-readable)
}

export interface AssetSpotPriceConnection {
  nodes: AssetSpotPriceNode[];
}

export interface GetAssetPricesAtBlockResponse {
  assetSpotPriceHistoricalData: AssetSpotPriceConnection;
}

export interface GetLatestAssetPricesResponse {
  assetSpotPriceHistoricalData: AssetSpotPriceConnection;
}

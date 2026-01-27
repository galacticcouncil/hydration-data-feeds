/**
 * GraphQL response types based on actual Hydration schema
 */

export interface SwapFeeNode {
  id: string;
  amount: string;
  assetId: string;
  destinationType: string;
  recipientId: string;
  // REMOVED: asset field no longer available in new endpoint
  // Decimals now fetched separately via AssetRegistryService
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
  assetInId: string;
  assetOutId: string;
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

export interface AssetNode {
  id: string;
  decimals: number;
}

export interface AssetsConnection {
  nodes: AssetNode[];
}

export interface GetAllAssetsResponse {
  assets: AssetsConnection;
}

// Money Market Event Types

export interface LiquidationEventNode {
  eventId: string;
  paraBlockHeight: number;
  liquidationCallId: string;
}

export interface LiquidationEventsConnection {
  totalCount: number;
  nodes: LiquidationEventNode[];
}

export interface GetLiquidationEventsResponse {
  moneyMarketEvents: LiquidationEventsConnection;
}

export interface TransferNode {
  eventId: string;
  paraBlockHeight: number;
  paraTimestamp: string; // ISO8601 timestamp - exists in transfers table
  fromId: string;
  toId: string;
  assetId: string;
  amount: string;
}

export interface TransfersConnection {
  nodes: TransferNode[];
}

export interface GetTreasuryTransfersResponse {
  transfers: TransfersConnection;
}

// PEPL Liquidation Event Types

export interface PeplLiquidationEventNode {
  id: string;
  collateralAssetId: string;
  debtAssetId: string;
  profit: string; // Raw profit amount (numeric string)
  paraBlockHeight: number; // Block height (can be filtered directly)
  eventId: string;
  event: {
    id: string;
    block: {
      timestamp: string; // ISO8601 timestamp
    };
  };
}

export interface PeplLiquidationEventsConnection {
  totalCount: number;
  nodes: PeplLiquidationEventNode[];
}

export interface GetPeplLiquidationEventsResponse {
  liquidationLiquidatedEvents: PeplLiquidationEventsConnection;
}

// Asset Reserve Event Types

export interface AssetReserveEventNode {
  id: string;
  assetId: string;
  amount: string; // Raw amount (numeric string)
  paraBlockHeight: number; // Block height (can be filtered directly)
  eventId: string;
  event: {
    id: string;
    block: {
      timestamp: string; // ISO8601 timestamp
    };
  };
}

export interface AssetReserveEventsConnection {
  nodes: AssetReserveEventNode[];
  totalCount: number;
}

export interface GetAssetReserveEventsResponse {
  mmMintedToTreasuryEvents: AssetReserveEventsConnection;
}

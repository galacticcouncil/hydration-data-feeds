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
  resourceType: string | null;
  underlyingAssetId: string | null;
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

// HSM Revenue Types

export interface AaveFacilitatorHistoricalDataNode {
  id: string;
  bucketLevel: string; // Raw amount (numeric string) - needs 18 decimal normalization
  paraBlockHeight: number;
  paraTimestamp: string; // ISO8601 timestamp
}

export interface AaveFacilitatorHistoricalDataConnection {
  nodes: AaveFacilitatorHistoricalDataNode[];
  totalCount: number;
}

export interface GetAaveFacilitatorHistoricalDataResponse {
  aaveFacilitatorHistoricalData: AaveFacilitatorHistoricalDataConnection;
}

export interface AccountTotalBalanceHistoricalDataNode {
  paraBlockHeight: number;
  totalTransferableNorm: string; // Already normalized
}

export interface AccountTotalBalanceHistoricalDataConnection {
  nodes: AccountTotalBalanceHistoricalDataNode[];
}

export interface GetAccountTotalBalanceHistoricalDataResponse {
  accountTotalBalanceHistoricalData: AccountTotalBalanceHistoricalDataConnection;
}

// Borrow APR Transfer Types

export interface BorrowAprTransferNode {
  amount: string;
  assetId: string;
  assetType: string;
  eventId: string;
  paraBlockHeight: number;
  paraTimestamp: string; // ISO8601 timestamp
  toId: string;
  fromId: string;
}

export interface BorrowAprTransfersConnection {
  totalCount: number;
  nodes: BorrowAprTransferNode[];
}

export interface GetBorrowAprTransfersResponse {
  transfers: BorrowAprTransfersConnection;
}

// Routed Trade Types (post-runtime-upgrade)

export interface SwapInputNode {
  assetId: string;
  amount: string; // Raw amount
}

export interface SwapOutputNode {
  assetId: string;
  amount: string; // Raw amount
}

export interface SwapInputsConnection {
  nodes: SwapInputNode[];
}

export interface SwapOutputsConnection {
  nodes: SwapOutputNode[];
}

export interface NestedSwapNode {
  id: string;
  operationId: string;
  paraTimestamp: string; // ISO8601 timestamp
  fillerId: string;
  fillerType: string; // "Omnipool"
  swapInputs: SwapInputsConnection;
  swapOutputs: SwapOutputsConnection;
  swapFees: SwapFeesConnection;
}

export interface NestedSwapsConnection {
  nodes: NestedSwapNode[];
}

export interface RoutedTradeNode {
  id: string;
  paraBlockHeight: number;
  inputAssetIds: string[]; // Array of input asset IDs
  outputAssetIds: string[]; // Array of output asset IDs
  swaps: NestedSwapsConnection; // Nested swaps with inputs/outputs
  // Note: paraTimestamp, fillerId, fillerType are on nested swaps, not here
}

export interface RoutedTradesConnection {
  totalCount: number;
  nodes: RoutedTradeNode[];
}

export interface GetRoutedTradesResponse {
  routedTrades: RoutedTradesConnection;
}

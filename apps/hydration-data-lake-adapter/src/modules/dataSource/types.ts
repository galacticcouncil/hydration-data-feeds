// API endpoints configuration
export enum ApiEndpoint {
  MAIN_INDEXER_API = 'MAIN_INDEXER_API',
}

export type PaginationConfig = {
  pageSize: number;
  offset: number;
  endpoint: ApiEndpoint;
};

export type GraphQLClientConfig = {
  url: string;
  headers?: Record<string, string>;
  endpoint: ApiEndpoint;
};

// Response wrapper for paginated data
export interface PaginatedResponse<T> {
  totalCount: number;
  data: T[];
}

// Generic request parameters
export interface RequestParams {
  limit?: number;
  offset?: number;
  fromBlock?: number;
  toBlock?: number;
}

export enum PoolType {
  Omnipool = 'Omnipool',
  Stableswap = 'Stableswap',
  Xykpool = 'Xykpool',
  Lbppool = 'Lbppool',
  Hsmpool = 'Hsmpool',
  AAVE = 'AAVE',
}

export enum SwapFillerType {
  Omnipool = 'Omnipool',
  Stableswap = 'Stableswap',
  XYK = 'XYK',
  LBP = 'LBP',
  OTC = 'OTC',
  HSM = 'HSM',
  AAVE = 'AAVE',
}

export enum AssetType {
  Bond = 'Bond',
  External = 'External',
  StableSwap = 'StableSwap',
  Token = 'Token',
  XYK = 'XYK',
  Erc20 = 'Erc20',
  PoolShare = 'PoolShare',
}

/**
 * Configuration interface for a single GraphQL endpoint
 * Represents a GraphQL endpoint that serves data for a specific block range
 */
export interface EndpointConfig {
  /**
   * The GraphQL API URL for this endpoint
   */
  apiUrl: string;

  /**
   * The starting block height (inclusive) for this endpoint's data range
   */
  fromBlockHeight: number;

  /**
   * The ending block height (inclusive) for this endpoint's data range
   * Special value: -1 means "to infinity" (current blockchain head)
   */
  toBlockHeight: number;
}

/**
 * Normalized endpoint configuration with -1 converted to Number.MAX_SAFE_INTEGER
 * Used internally for range calculations and comparisons
 */
export interface NormalizedEndpointConfig {
  /**
   * The GraphQL API URL for this endpoint
   */
  apiUrl: string;

  /**
   * The starting block height (inclusive) for this endpoint's data range
   */
  fromBlockHeight: number;

  /**
   * The ending block height (inclusive) for this endpoint's data range
   * -1 is converted to Number.MAX_SAFE_INTEGER for internal calculations
   */
  toBlockHeight: number;

  /**
   * Flag indicating if this endpoint represents the "head" (ongoing data)
   * true if original toBlockHeight was -1
   */
  isHeadEndpoint: boolean;
}

/**
 * Represents a block range for queries
 */
export interface BlockRange {
  /**
   * The starting block (inclusive)
   */
  fromBlock: number;

  /**
   * The ending block (inclusive)
   */
  toBlock: number;
}

/**
 * Assignment of an endpoint to a specific block range
 * Used when splitting queries across multiple endpoints
 */
export interface EndpointAssignment {
  /**
   * The endpoint configuration to use
   */
  endpoint: NormalizedEndpointConfig;

  /**
   * The specific block range to query from this endpoint
   */
  blockRange: BlockRange;
}

/**
 * Multi-endpoint configuration
 */
export interface MultiEndpointConfig {
  /**
   * Whether multi-endpoint mode is enabled
   */
  enabled: boolean;

  /**
   * Array of normalized endpoint configurations
   */
  endpoints: NormalizedEndpointConfig[];

  /**
   * Legacy fallback endpoint URL (for single-endpoint mode)
   */
  fallbackUrl: string;
}

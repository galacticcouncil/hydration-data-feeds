// Without 0x prefix — used in address substring checks and GraphQL query variables
export const BORROW_APR_TREASURY_ADDRESS = '8c0f3b9602374198974d2b2679d14a386f5b108e';
export const MONEY_MARKET_TREASURY_ADDRESS = 'e52567ff06acd6cbe7ba94dc777a3126e180b6d9';
export const ZERO_ADDRESS = '0000000000000000000000000000000000000000000000000000000000000000';

// With 0x prefix — used in entity field construction
export const MONEY_MARKET_TREASURY_ADDRESS_HEX = `0x${MONEY_MARKET_TREASURY_ADDRESS}`;
export const ZERO_ADDRESS_HEX = `0x${ZERO_ADDRESS}`;

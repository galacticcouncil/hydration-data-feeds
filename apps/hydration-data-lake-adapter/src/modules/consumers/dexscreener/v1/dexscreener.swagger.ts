
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

export const DexScreenerSwagger = {
  getLatestBlock: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Get latest indexed block',
        description:
          'Returns the latest block that has been indexed and is available for data retrieval.',
      }),
      ApiResponse({
        status: 200,
        description: 'Successfully retrieved the latest block information',
        schema: {
          type: 'object',
          properties: {
            block: {
              type: 'object',
              properties: {
                blockNumber: {
                  type: 'number',
                  example: 8500009,
                  description: 'The block number/height',
                },
                blockTimestamp: {
                  type: 'number',
                  example: 1753491138,
                  description: 'Unix timestamp when the block was created',
                },
                metadata: {
                  type: 'object',
                  additionalProperties: { type: 'string' },
                  description: 'Additional block metadata',
                  example: {
                    hash: '0x1234...',
                    parentHash: '0x5678...',
                  },
                },
              },
              required: ['blockNumber', 'blockTimestamp'],
            },
          },
          required: ['block'],
        },
      }),
      ApiResponse({
        status: 404,
        description: 'Latest block not found',
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'string',
              example: 'Latest block not found',
            },
            timestamp: {
              type: 'string',
              example: '2024-01-01T00:00:00.000Z',
            },
          },
        },
      }),
      ApiResponse({
        status: 500,
        description: 'Internal server error',
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'string',
              example: 'Failed to fetch latest block',
            },
            timestamp: {
              type: 'string',
              example: '2024-01-01T00:00:00.000Z',
            },
          },
        },
      })
    ),

  getEvents: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Get swap events in block range',
        description:
          'Returns swap events that occurred within the specified block range. Each event contains detailed information about token swaps including transaction details, maker address, and asset amounts.',
      }),
      ApiQuery({
        name: 'fromBlock',
        type: 'number',
        description: 'Starting block number (inclusive)',
        example: 8500002,
        required: true,
      }),
      ApiQuery({
        name: 'toBlock',
        type: 'number',
        description: 'Ending block number (inclusive)',
        example: 8500009,
        required: true,
      }),
      ApiResponse({
        status: 200,
        description: 'Successfully retrieved swap events in the specified block range',
        schema: {
          type: 'object',
          properties: {
            events: {
              type: 'array',
              description: 'Array of swap events',
              items: {
                type: 'object',
                properties: {
                  block: {
                    type: 'object',
                    description: 'Block information where the event occurred',
                    properties: {
                      blockNumber: {
                        type: 'number',
                        example: 8500002,
                        description: 'Block number/height',
                      },
                      blockTimestamp: {
                        type: 'number',
                        example: 1753491090,
                        description: 'Unix timestamp when the block was created',
                      },
                    },
                    required: ['blockNumber', 'blockTimestamp'],
                  },
                  eventType: {
                    type: 'string',
                    example: 'swap',
                    description: 'Type of event (always "swap" for this endpoint)',
                  },
                  txnId: {
                    type: 'string',
                    example: '8500002-3934845',
                    description: 'Transaction identifier (transaction hash or unique ID)',
                  },
                  txnIndex: {
                    type: 'number',
                    example: 0,
                    description: 'Order of transaction within a block (higher = later in block)',
                  },
                  eventIndex: {
                    type: 'number',
                    example: 21,
                    description:
                      'Order of event within a transaction (higher = later in transaction)',
                  },
                  maker: {
                    type: 'string',
                    example: '1nkBXKLCyX5D3bGnEyk49Rry5CHKkHWYYhsoC7u9BdJyGSG',
                    description: 'Account identifier responsible for submitting the transaction',
                  },
                  pairId: {
                    type: 'string',
                    example: '1-102',
                    description: 'Trading pair identifier (format: asset0-asset1)',
                  },
                  priceNative: {
                    type: 'string',
                    example: '0',
                    description: 'Price of asset0 quoted in asset1 for this swap',
                  },
                  reserves: {
                    type: 'object',
                    description: 'Pool reserves after the swap (decimalized amounts)',
                    properties: {
                      asset0: {
                        type: 'string',
                        example: '0',
                        description: 'Reserve amount of asset0 in the pool',
                      },
                      asset1: {
                        type: 'string',
                        example: '0',
                        description: 'Reserve amount of asset1 in the pool',
                      },
                    },
                    required: ['asset0', 'asset1'],
                  },
                  asset0In: {
                    type: 'string',
                    example: '6.780563154203',
                    description:
                      'Amount of asset0 swapped in (decimalized). Present when asset0 is input.',
                  },
                  asset1In: {
                    type: 'string',
                    example: '143.964875437368865847',
                    description:
                      'Amount of asset1 swapped in (decimalized). Present when asset1 is input.',
                  },
                  asset0Out: {
                    type: 'string',
                    example: '145.575606',
                    description:
                      'Amount of asset0 swapped out (decimalized). Present when asset0 is output.',
                  },
                  asset1Out: {
                    type: 'string',
                    example: '143.964875437368865847',
                    description:
                      'Amount of asset1 swapped out (decimalized). Present when asset1 is output.',
                  },
                  metadata: {
                    type: 'object',
                    additionalProperties: { type: 'string' },
                    description: 'Optional auxiliary information not covered in the default schema',
                  },
                },
                required: [
                  'block',
                  'eventType',
                  'txnId',
                  'txnIndex',
                  'eventIndex',
                  'maker',
                  'pairId',
                  'priceNative',
                  'reserves',
                ],
              },
            },
          },
          required: ['events'],
        },
      }),
      ApiResponse({
        status: 400,
        description: 'Bad request - invalid block range parameters',
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'string',
              example: 'fromBlock must be less than or equal to toBlock',
            },
            timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
          },
        },
      }),
      ApiResponse({
        status: 404,
        description: 'No events found for the specified block range',
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'string',
              example: 'No events found for the specified block range',
            },
            timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
          },
        },
      }),
      ApiResponse({
        status: 500,
        description: 'Internal server error',
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'string',
              example: 'Failed to fetch events',
            },
            timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
          },
        },
      })
    ),

  getAsset: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Get asset by ID',
        description: 'Returns detailed information about a specific asset.',
      }),
      ApiQuery({
        name: 'id',
        type: 'string',
        description: 'Asset identifier',
        example: '1',
        required: true,
      }),
      ApiResponse({
        status: 200,
        description: 'Successfully retrieved asset information',
        schema: {
          type: 'object',
          properties: {
            asset: {
              type: 'object',
              properties: {
                id: { type: 'string', example: '1' },
                name: { type: 'string', example: 'DOT' },
                symbol: { type: 'string', example: 'DOT' },
                decimals: { type: 'number', example: 10 },
              },
            },
          },
        },
      }),
      ApiResponse({
        status: 404,
        description: 'Asset not found',
      }),
      ApiResponse({
        status: 500,
        description: 'Internal server error',
      })
    ),

  getPair: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Get trading pair by ID',
        description:
          'Returns detailed information about a specific trading pair. Pair IDs are immutable and correspond to contract addresses in most cases. All pair properties are immutable - the indexer will not query a given pair more than once.',
      }),
      ApiQuery({
        name: 'id',
        type: 'string',
        description: 'Pair identifier in format "asset0Id-asset1Id"',
        example: '0x11b815efB8f581194ae79006d24E0d814B7697F6',
        required: true,
      }),
      ApiResponse({
        status: 200,
        description: 'Successfully retrieved pair information',
        schema: {
          type: 'object',
          properties: {
            pair: {
              type: 'object',
              description: 'Trading pair information',
              properties: {
                id: {
                  type: 'string',
                  example: '0x11b815efB8f581194ae79006d24E0d814B7697F6',
                  description: 'Unique pair identifier, typically a contract address. Case-sensitive.',
                },
                dexKey: {
                  type: 'string',
                  example: 'uniswap',
                  description: 'Identifier for the DEX that hosts this pair',
                },
                asset0Id: {
                  type: 'string',
                  example: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
                  description: 'First asset identifier in the pair. Order never changes.',
                },
                asset1Id: {
                  type: 'string',
                  example: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
                  description: 'Second asset identifier in the pair. Order never changes.',
                },
                createdAtBlockNumber: {
                  type: 'number',
                  example: 100,
                  description: 'Block number when the pair was created',
                },
                createdAtBlockTimestamp: {
                  type: 'number',
                  example: 1698126147,
                  description: 'Unix timestamp when the pair was created',
                },
                createdAtTxnId: {
                  type: 'string',
                  example: '0xe9e91f1ee4b56c0df2e9f06c2b8c27c6076195a88a7b8537ba8313d80e6f124e',
                  description: 'Transaction ID where the pair was created',
                },
                creator: {
                  type: 'string',
                  example: '0x742d35Cc6634C0532925a3b8D0Ae5D8d5b2bD8E5',
                  description: 'Address of the pair creator',
                },
                feeBps: {
                  type: 'number',
                  example: 100,
                  description: 'Swap fees in basis points (100 = 1%)',
                },
                pool: {
                  type: 'object',
                  description: 'Pool information for multi-asset pools',
                  properties: {
                    id: {
                      type: 'string',
                      example: 'pool-123',
                      description: 'Pool identifier',
                    },
                    name: {
                      type: 'string',
                      example: 'Uniswap V3 Pool',
                      description: 'Pool name',
                    },
                    assetIds: {
                      type: 'array',
                      items: { type: 'string' },
                      example: ['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', '0xdAC17F958D2ee523a2206206994597C13D831ec7'],
                      description: 'Array of asset IDs in the pool',
                    },
                    pairIds: {
                      type: 'array',
                      items: { type: 'string' },
                      example: ['0x11b815efB8f581194ae79006d24E0d814B7697F6'],
                      description: 'Array of pair IDs in the pool',
                    },
                    metadata: {
                      type: 'object',
                      additionalProperties: { type: 'string' },
                      description: 'Additional pool metadata',
                    },
                  },
                  required: ['id', 'name', 'assetIds', 'pairIds'],
                },
                metadata: {
                  type: 'object',
                  additionalProperties: { type: 'string' },
                  description: 'Optional auxiliary information not covered in the default schema',
                },
              },
              required: ['id', 'dexKey', 'asset0Id', 'asset1Id'],
            },
          },
          required: ['pair'],
        },
      }),
      ApiResponse({
        status: 400,
        description: 'Bad request - invalid pair ID format',
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'string',
              example: 'Pair ID is required',
            },
            timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
          },
        },
      }),
      ApiResponse({
        status: 404,
        description: 'Pair not found',
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'string',
              example: 'Pair not found',
            },
            timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
          },
        },
      }),
      ApiResponse({
        status: 500,
        description: 'Internal server error',
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'string',
              example: 'Failed to fetch pair',
            },
            timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
          },
        },
      })
    ),

  healthCheck: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Health check',
        description:
          'Returns the health status of the DEX Screener adapter and available endpoints.',
      }),
      ApiResponse({
        status: 200,
        description: 'Service is healthy',
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                consumer: { type: 'string', example: 'dexscreener' },
                version: { type: 'string', example: 'v1' },
                status: { type: 'string', example: 'OK' },
                endpoints: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['latest-block', 'asset', 'pair', 'events'],
                },
              },
            },
            timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
          },
        },
      })
    ),
};
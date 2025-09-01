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
                  example: 1234567,
                  description: 'The block number/height',
                },
                blockTimestamp: {
                  type: 'number',
                  example: 1698126147,
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
        summary: 'Get events in block range',
        description: 'Returns swap events that occurred within the specified block range.',
      }),
      ApiQuery({
        name: 'fromBlock',
        type: 'number',
        description: 'Starting block number (inclusive)',
        example: 8500000,
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
        description: 'Successfully retrieved events in the specified block range',
        schema: {
          type: 'object',
          properties: {
            events: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  block: {
                    type: 'object',
                    properties: {
                      blockNumber: { type: 'number', example: 1050 },
                      blockTimestamp: { type: 'number', example: 1698126147 },
                      metadata: {
                        type: 'object',
                        additionalProperties: { type: 'string' },
                      },
                    },
                  },
                  eventType: { type: 'string', example: 'swap' },
                  txnId: { type: 'string', example: '0x123abc...' },
                  txnIndex: { type: 'number', example: 0 },
                  eventIndex: { type: 'number', example: 5 },
                  maker: {
                    type: 'string',
                    example: '7L53bUTBbfuj14UpdCNPwmgzzHSsrsTWBHX5pys32mVWM3C1',
                  },
                  pairId: { type: 'string', example: 'pair_123' },
                  priceNative: { type: 'string', example: '0' },
                  reserves: {
                    type: 'object',
                    properties: {
                      asset0: { type: 'string', example: '1000000' },
                      asset1: { type: 'string', example: '2000000' },
                    },
                  },
                  asset0In: {
                    type: 'string',
                    example: '100.5',
                    description: 'Amount of asset0 swapped in (if applicable)',
                  },
                  asset1In: {
                    type: 'string',
                    example: '200.25',
                    description: 'Amount of asset1 swapped in (if applicable)',
                  },
                  asset0Out: {
                    type: 'string',
                    example: '150.75',
                    description: 'Amount of asset0 swapped out (if applicable)',
                  },
                  asset1Out: {
                    type: 'string',
                    example: '300.0',
                    description: 'Amount of asset1 swapped out (if applicable)',
                  },
                },
              },
            },
          },
        },
      }),
      ApiResponse({
        status: 400,
        description: 'Bad request - invalid block range parameters',
      }),
      ApiResponse({
        status: 404,
        description: 'No events found for the specified block range',
      }),
      ApiResponse({
        status: 500,
        description: 'Internal server error',
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

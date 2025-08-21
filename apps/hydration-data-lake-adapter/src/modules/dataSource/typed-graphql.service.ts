// import { Injectable, Logger } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { QueriesHelper } from '../graphql/queries-helper';
// import { ApiEndpoint } from '../graphql/types';
// import { AppConfig } from '../config';
//
// // Import GraphQL documents - these will be string literals for now
// // In a real implementation, you would import the actual GraphQL documents
// const GetLatestBlockDocument = `
//   query GetLatestBlock {
//     latestBlock {
//       number
//       timestamp
//       hash
//       metadata
//     }
//   }
// `;
//
// const GetBlockByNumberDocument = `
//   query GetBlockByNumber($blockNumber: Int!) {
//     block(number: $blockNumber) {
//       number
//       timestamp
//       hash
//       metadata
//     }
//   }
// `;
//
// const GetAssetDocument = `
//   query GetAsset($id: String!) {
//     asset(id: $id) {
//       id
//       name
//       symbol
//       totalSupply
//       circulatingSupply
//       decimals
//       coinGeckoId
//       coinMarketCapId
//       metadata
//     }
//   }
// `;
//
// const GetAssetsDocument = `
//   query GetAssets($ids: [String!]!) {
//     assets(ids: $ids) {
//       id
//       name
//       symbol
//       totalSupply
//       circulatingSupply
//       decimals
//       coinGeckoId
//       coinMarketCapId
//       metadata
//     }
//   }
// `;
//
// const GetPairDocument = `
//   query GetPair($id: String!) {
//     pair(id: $id) {
//       id
//       asset0 {
//         id
//         name
//         symbol
//       }
//       asset1 {
//         id
//         name
//         symbol
//       }
//       createdAtBlockNumber
//       createdAtTimestamp
//       createdAtTxnId
//       creator
//       feeBps
//       reserves {
//         asset0
//         asset1
//       }
//       pool {
//         id
//         name
//         assetIds
//         pairIds
//         metadata
//       }
//       metadata
//     }
//   }
// `;
//
// const GetPairsDocument = `
//   query GetPairs($ids: [String!]!) {
//     pairs(ids: $ids) {
//       id
//       asset0 {
//         id
//         name
//         symbol
//       }
//       asset1 {
//         id
//         name
//         symbol
//       }
//       createdAtBlockNumber
//       createdAtTimestamp
//       createdAtTxnId
//       creator
//       feeBps
//       reserves {
//         asset0
//         asset1
//       }
//       pool {
//         id
//         name
//         assetIds
//         pairIds
//         metadata
//       }
//       metadata
//     }
//   }
// `;
//
// const GetEventsDocument = `
//   query GetEvents($fromBlock: Int!, $toBlock: Int!, $limit: Int, $offset: Int) {
//     events(fromBlock: $fromBlock, toBlock: $toBlock, limit: $limit, offset: $offset) {
//       totalCount
//       data {
//         ... on SwapEvent {
//           block {
//             number
//             timestamp
//             hash
//             metadata
//           }
//           eventType
//           txnId
//           txnIndex
//           eventIndex
//           maker
//           pairId
//           asset0In
//           asset1In
//           asset0Out
//           asset1Out
//           priceNative
//           reserves {
//             asset0
//             asset1
//           }
//           metadata
//         }
//         ... on JoinExitEvent {
//           block {
//             number
//             timestamp
//             hash
//             metadata
//           }
//           eventType
//           txnId
//           txnIndex
//           eventIndex
//           maker
//           pairId
//           amount0
//           amount1
//           reserves {
//             asset0
//             asset1
//           }
//           metadata
//         }
//       }
//     }
//   }
// `;
//
// const GetSwapEventsDocument = `
//   query GetSwapEvents($fromBlock: Int!, $toBlock: Int!, $pairIds: [String!], $limit: Int, $offset: Int) {
//     swapEvents(fromBlock: $fromBlock, toBlock: $toBlock, pairIds: $pairIds, limit: $limit, offset: $offset) {
//       totalCount
//       data {
//         block {
//           number
//           timestamp
//           hash
//         }
//         eventType
//         txnId
//         txnIndex
//         eventIndex
//         maker
//         pairId
//         asset0In
//         asset1In
//         asset0Out
//         asset1Out
//         priceNative
//         reserves {
//           asset0
//           asset1
//         }
//         metadata
//       }
//     }
//   }
// `;
//
// // Import generated types (these will be available after running codegen)
// import type {
//   GetLatestBlockQuery,
//   GetLatestBlockQueryVariables,
//   GetBlockByNumberQuery,
//   GetBlockByNumberQueryVariables,
//   GetAssetQuery,
//   GetAssetQueryVariables,
//   GetAssetsQuery,
//   GetAssetsQueryVariables,
//   GetPairQuery,
//   GetPairQueryVariables,
//   GetPairsQuery,
//   GetPairsQueryVariables,
//   GetEventsQuery,
//   GetEventsQueryVariables,
//   GetSwapEventsQuery,
//   GetSwapEventsQueryVariables,
// } from '../graphql/generated/types';
//
// @Injectable()
// export class TypedGraphQLService {
//   private readonly logger = new Logger(TypedGraphQLService.name, { timestamp: true });
//
//   constructor(
//     private readonly queriesHelper: QueriesHelper,
//     private readonly configService: ConfigService,
//     private readonly appConfig: AppConfig,
//   ) {
//     this.logger.log('TypedGraphQLService initialized');
//   }
//
//   // Block queries
//   async getLatestBlock(endpoint: ApiEndpoint = ApiEndpoint.MAIN_API): Promise<GetLatestBlockQuery | null> {
//     const { data, error } = await this.queriesHelper.gqlRequest<GetLatestBlockQuery, GetLatestBlockQueryVariables>({
//       query: GetLatestBlockDocument,
//       endpoint,
//     });
//
//     if (error) {
//       this.logger.error('Failed to fetch latest block:', error);
//       return null;
//     }
//
//     return data || null;
//   }
//
//   async getBlockByNumber(
//     blockNumber: number,
//     endpoint: ApiEndpoint = ApiEndpoint.MAIN_API
//   ): Promise<GetBlockByNumberQuery | null> {
//     const { data, error } = await this.queriesHelper.gqlRequest<GetBlockByNumberQuery, GetBlockByNumberQueryVariables>({
//       query: GetBlockByNumberDocument,
//       variables: { blockNumber },
//       endpoint,
//     });
//
//     if (error) {
//       this.logger.error(`Failed to fetch block ${blockNumber}:`, error);
//       return null;
//     }
//
//     return data || null;
//   }
//
//   // Asset queries
//   async getAsset(
//     id: string,
//     endpoint: ApiEndpoint = ApiEndpoint.ASSETS
//   ): Promise<GetAssetQuery | null> {
//     const { data, error } = await this.queriesHelper.gqlRequest<GetAssetQuery, GetAssetQueryVariables>({
//       query: GetAssetDocument,
//       variables: { id },
//       endpoint,
//     });
//
//     if (error) {
//       this.logger.error(`Failed to fetch asset ${id}:`, error);
//       return null;
//     }
//
//     return data || null;
//   }
//
//   async getAssets(
//     ids: string[],
//     endpoint: ApiEndpoint = ApiEndpoint.ASSETS
//   ): Promise<GetAssetsQuery | null> {
//     const { data, error } = await this.queriesHelper.gqlRequest<GetAssetsQuery, GetAssetsQueryVariables>({
//       query: GetAssetsDocument,
//       variables: { ids },
//       endpoint,
//     });
//
//     if (error) {
//       this.logger.error(`Failed to fetch assets:`, error);
//       return null;
//     }
//
//     return data || null;
//   }
//
//   // Pair queries
//   async getPair(
//     id: string,
//     endpoint: ApiEndpoint = ApiEndpoint.PAIRS
//   ): Promise<GetPairQuery | null> {
//     const { data, error } = await this.queriesHelper.gqlRequest<GetPairQuery, GetPairQueryVariables>({
//       query: GetPairDocument,
//       variables: { id },
//       endpoint,
//     });
//
//     if (error) {
//       this.logger.error(`Failed to fetch pair ${id}:`, error);
//       return null;
//     }
//
//     return data || null;
//   }
//
//   async getPairs(
//     ids: string[],
//     endpoint: ApiEndpoint = ApiEndpoint.PAIRS
//   ): Promise<GetPairsQuery | null> {
//     const { data, error } = await this.queriesHelper.gqlRequest<GetPairsQuery, GetPairsQueryVariables>({
//       query: GetPairsDocument,
//       variables: { ids },
//       endpoint,
//     });
//
//     if (error) {
//       this.logger.error(`Failed to fetch pairs:`, error);
//       return null;
//     }
//
//     return data || null;
//   }
//
//   // Event queries
//   async getEvents(
//     variables: GetEventsQueryVariables,
//     endpoint: ApiEndpoint = ApiEndpoint.EVENTS
//   ): Promise<GetEventsQuery | null> {
//     const { data, error } = await this.queriesHelper.gqlRequest<GetEventsQuery, GetEventsQueryVariables>({
//       query: GetEventsDocument,
//       variables,
//       endpoint,
//     });
//
//     if (error) {
//       this.logger.error('Failed to fetch events:', error);
//       return null;
//     }
//
//     return data || null;
//   }
//
//   async getSwapEvents(
//     variables: GetSwapEventsQueryVariables,
//     endpoint: ApiEndpoint = ApiEndpoint.EVENTS
//   ): Promise<GetSwapEventsQuery | null> {
//     const { data, error } = await this.queriesHelper.gqlRequest<GetSwapEventsQuery, GetSwapEventsQueryVariables>({
//       query: GetSwapEventsDocument,
//       variables,
//       endpoint,
//     });
//
//     if (error) {
//       this.logger.error('Failed to fetch swap events:', error);
//       return null;
//     }
//
//     return data || null;
//   }
//
//   // Paginated data fetching
//   async *fetchAllEvents(
//     variables: Omit<GetEventsQueryVariables, 'limit' | 'offset'>,
//     pageSize: number = 1000,
//     endpoint: ApiEndpoint = ApiEndpoint.EVENTS
//   ): AsyncGenerator<GetEventsQuery['events']['data'], void, unknown> {
//     const requestPromise = async ({
//       pageSize: limit,
//       offset,
//     }: {
//       pageSize: number;
//       offset: number;
//       endpoint: ApiEndpoint;
//     }) => {
//       const result = await this.getEvents(
//         { ...variables, limit, offset },
//         endpoint
//       );
//
//       if (!result?.events) {
//         throw new Error('Failed to fetch events');
//       }
//
//       return {
//         totalCount: result.events.totalCount,
//         data: result.events.data,
//       };
//     };
//
//     for await (const page of this.queriesHelper.fetchAllPages({
//       requestPromise,
//       limit: pageSize,
//       endpoint,
//     })) {
//       yield page;
//     }
//   }
//
//   // Health check for endpoints
//   async checkEndpointHealth(endpoint: ApiEndpoint): Promise<boolean> {
//     try {
//       const result = await this.getLatestBlock(endpoint);
//       return !!result;
//     } catch (error) {
//       this.logger.error(`Health check failed for endpoint ${endpoint}:`, error);
//       return false;
//     }
//   }
//
//   // Get all configured endpoints
//   getAvailableEndpoints(): ApiEndpoint[] {
//     return this.queriesHelper.getConfiguredEndpoints();
//   }
// }

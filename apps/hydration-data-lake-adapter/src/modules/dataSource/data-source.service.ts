import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../config';
import { GraphqlClientProvider } from '../../providers/graphql-client.provider';
import {
  DexScreenerCacheProviderToken,
  GraphQlClientProviderToken,
  MainIndexerCacheProviderToken,
} from '../../providers';
import { ApiEndpoint, PaginationConfig } from './types';
import {
  GetLatestStableswapLiquidityEventWithBlock,
  GetLatestStableswapLiquidityEventWithBlockQuery,
  GetLatestStableswapLiquidityEventWithBlockQueryVariables,
  GetLatestSwapWithBlock,
  GetLatestSwapWithBlockQuery,
  GetLatestSwapWithBlockQueryVariables,
  StableswapLiquidityEventsOrderBy,
  SwapsOrderBy,
  GetAssetById,
  GetAssetByIdQuery,
  GetAssetByIdQueryVariables,
  GetBlockByHeight,
  GetBlockByHeightQuery,
  GetBlockByHeightQueryVariables,
  GetAssetHistDataAtBlock,
  GetAssetHistDataAtBlockQuery,
  GetAssetHistDataAtBlockQueryVariables,
  AssetHistoricalDataOrderBy,
  GetAccountAssetBalanceHistDataAtBlock,
  GetAccountAssetBalanceHistDataAtBlockQuery,
  GetAccountAssetBalanceHistDataAtBlockQueryVariables,
  AccountAssetBalanceHistoricalDataOrderBy,
  GetAavepool,
  GetAavepoolQuery,
  GetAavepoolQueryVariables,
  GetAavepoolHistDataAtBlockQueryVariables,
  GetAavepoolHistDataAtBlockQuery,
  GetAavepoolHistDataAtBlock,
  AavepoolHistoricalDataOrderBy,
  GetPoolByAccount,
  GetPoolByAccountQuery,
  GetPoolByAccountQueryVariables,
} from './graphqlSupport/mainIndexer/apiTypes';
import {
  DatasourceAavepool,
  DatasourceAavepoolHistoricalData,
  DatasourceAccountAssetBalanceHistoricalData,
  DatasourceAccountData,
  DatasourceAsset,
  DatasourceAssetHistoricalData,
  DatasourceBlock,
  DatasourceSwap,
} from './graphqlSupport/types';
import {
  GetSwapsInBlocksRange,
  GetSwapsInBlocksRangeQuery,
  GetSwapsInBlocksRangeQueryVariables,
} from './graphqlSupport/mainIndexer/apiTypes';
import { MainIndexerCacheProvider } from '../../providers/cache/main-indexer-cache.provider';

@Injectable()
export class DataSourceService {
  private readonly logger = new Logger(DataSourceService.name, { timestamp: true });

  constructor(
    private appConfig: AppConfig,

    @Inject(GraphQlClientProviderToken)
    private graphqlClientProvider: GraphqlClientProvider,

    @Inject(MainIndexerCacheProviderToken)
    private mainIndexerCacheProvider: MainIndexerCacheProvider
  ) {}

  async fetchBlocksByHeightsList({
    heightsList,
    endpoint = ApiEndpoint.MAIN_INDEXER_API,
  }: {
    heightsList: number[];
    endpoint?: ApiEndpoint;
  }): Promise<DatasourceBlock[]> {
    const { data, error } = await this.graphqlClientProvider.gqlRequest<
      GetBlockByHeightQuery,
      GetBlockByHeightQueryVariables
    >({
      query: GetBlockByHeight,
      variables: {
        filter: { height: { in: heightsList } },
      },
      endpoint,
    });

    if (error) {
      this.logger.error(`Failed to fetch block with heights ${heightsList}:`, error);
      return null;
    }

    return data.blocks.nodes || null;
  }

  async fetchLatestProcessedBlock({
    ensuredByEvents = true,
    endpoint = ApiEndpoint.MAIN_INDEXER_API,
  }: {
    ensuredByEvents?: boolean;
    endpoint?: ApiEndpoint;
  }): Promise<DatasourceBlock | null> {
    const { data: latestSwapWithBlock, error: swapRequestError } =
      await this.graphqlClientProvider.gqlRequest<
        GetLatestSwapWithBlockQuery,
        GetLatestSwapWithBlockQueryVariables
      >({
        query: GetLatestSwapWithBlock,
        variables: {
          first: 1,
          orderBy: [SwapsOrderBy.ParaBlockHeightDesc],
        },
        endpoint,
      });

    if (swapRequestError) {
      this.logger.error(`Failed to fetch pairs:`, swapRequestError);
      return null;
    }

    const { data: latestStableswapLiqEventWithBlock, error: liqEventRequestError } =
      await this.graphqlClientProvider.gqlRequest<
        GetLatestStableswapLiquidityEventWithBlockQuery,
        GetLatestStableswapLiquidityEventWithBlockQueryVariables
      >({
        query: GetLatestStableswapLiquidityEventWithBlock,
        variables: {
          first: 1,
          orderBy: [StableswapLiquidityEventsOrderBy.ParaBlockHeightDesc],
        },
        endpoint,
      });

    if (liqEventRequestError) {
      this.logger.error(`Failed to fetch pairs:`, liqEventRequestError);
      return null;
    }

    const swapBlockData = latestSwapWithBlock.swaps.nodes[0].event.block;
    const liquidityEventblockData =
      latestStableswapLiqEventWithBlock.stableswapLiquidityEvents.nodes[0].event.block;

    const blocksMap = new Map<number, DatasourceBlock>([
      [swapBlockData.height, swapBlockData],
      [liquidityEventblockData.height, liquidityEventblockData],
    ]);

    const highestBlockHeight = Math.max(...blocksMap.keys());

    return blocksMap.get(highestBlockHeight) || null;
  }

  async fetchAssetById({
    id,
    endpoint = ApiEndpoint.MAIN_INDEXER_API,
  }: {
    id: string;
    endpoint?: ApiEndpoint;
  }): Promise<DatasourceAsset | null> {
    const { data, error } = await this.graphqlClientProvider.gqlRequest<
      GetAssetByIdQuery,
      GetAssetByIdQueryVariables
    >({
      query: GetAssetById,
      variables: {
        id,
      },
      endpoint,
    });

    if (error) {
      this.logger.error(`Failed to fetch pairs:`, error);
      return null;
    }

    return data.asset || null;
  }

  async fetchSwapsInBlocksRange({
    fromBlock,
    toBlock,
    endpoint = ApiEndpoint.MAIN_INDEXER_API,
  }: {
    fromBlock: number;
    toBlock: number;
    endpoint?: ApiEndpoint;
  }): Promise<DatasourceSwap[] | null> {
    const allPagesRaw: DatasourceSwap[][] = [];

    const fetchSwapsPaginated = async ({
      pageSize,
      offset,
      endpoint,
    }: PaginationConfig): Promise<{ data: DatasourceSwap[]; totalCount: number }> => {
      const { data, error } = await this.graphqlClientProvider.gqlRequest<
        GetSwapsInBlocksRangeQuery,
        GetSwapsInBlocksRangeQueryVariables
      >({
        query: GetSwapsInBlocksRange,
        variables: {
          first: pageSize,
          offset,
          orderBy: [SwapsOrderBy.ParaBlockHeightAsc],
          filter: {
            paraBlockHeight: { greaterThanOrEqualTo: fromBlock },
            and: [{ paraBlockHeight: { lessThanOrEqualTo: toBlock } }],
          },
        },
        endpoint,
      });

      if (error) {
        this.logger.error(`Failed to fetch pairs:`, error);
        return null;
      }

      return {
        data: data.swaps.nodes || [],
        totalCount: data.swaps.totalCount,
      };
    };

    for await (const page of this.graphqlClientProvider.fetchAllPages({
      limit: this.appConfig.MAX_BLOCKS_RANGE_FETCH_BATCH,
      requestPromise: fetchSwapsPaginated,
      endpoint,
    })) {
      if (!page) continue;
      allPagesRaw.push(page);
    }

    return allPagesRaw.flat() || null;
  }

  async fetchAssetHistDataByBlockHeight({
    assetId,
    blockHeight,
    endpoint = ApiEndpoint.MAIN_INDEXER_API,
  }: {
    assetId: string;
    blockHeight: number;
    endpoint?: ApiEndpoint;
  }): Promise<DatasourceAssetHistoricalData | null> {
    const cachedData = await this.mainIndexerCacheProvider.getAssetHistDataAtBlock({
      assetId,
      blockHeight,
    });
    if (cachedData) return cachedData;

    const { data, error } = await this.graphqlClientProvider.gqlRequest<
      GetAssetHistDataAtBlockQuery,
      GetAssetHistDataAtBlockQueryVariables
    >({
      query: GetAssetHistDataAtBlock,
      variables: {
        first: 1,
        orderBy: AssetHistoricalDataOrderBy.ParaBlockHeightDesc,
        filter: {
          assetId: { equalTo: assetId },
          paraBlockHeight: { lessThanOrEqualTo: blockHeight },
        },
      },
      endpoint,
    });

    if (error) {
      this.logger.error(
        `Failed to fetch asset historical data for asset ${assetId} as block ${blockHeight}:`,
        error
      );
      return null;
    }

    const response = data.assetHistoricalData.nodes[0];
    if (response)
      await this.mainIndexerCacheProvider.setAssetHistDataAtBlock({
        assetId,
        blockHeight,
        entity: response,
      });

    return data.assetHistoricalData.nodes[0] || null;
  }

  async fetchAccountAssetBalanceHistDataByBlockHeight({
    accountPubKey,
    assetId,
    blockHeight,
    endpoint = ApiEndpoint.MAIN_INDEXER_API,
  }: {
    accountPubKey: string;
    assetId: string;
    blockHeight: number;
    endpoint?: ApiEndpoint;
  }): Promise<DatasourceAccountAssetBalanceHistoricalData | null> {
    const cachedData = await this.mainIndexerCacheProvider.getAccountAssetBalanceHistDataAtBlock({
      address: accountPubKey,
      assetId,
      blockHeight,
    });
    if (cachedData) return cachedData;

    const { data, error } = await this.graphqlClientProvider.gqlRequest<
      GetAccountAssetBalanceHistDataAtBlockQuery,
      GetAccountAssetBalanceHistDataAtBlockQueryVariables
    >({
      query: GetAccountAssetBalanceHistDataAtBlock,
      variables: {
        first: 1,
        orderBy: AccountAssetBalanceHistoricalDataOrderBy.ParaBlockHeightDesc,
        filter: {
          accountId: { equalTo: accountPubKey },
          assetId: { equalTo: assetId },
          paraBlockHeight: { lessThanOrEqualTo: blockHeight },
        },
      },
      endpoint,
    });

    if (error) {
      this.logger.error(
        `Failed to fetch account asset balance historical data for account ${accountPubKey}, asset ${assetId} as block ${blockHeight}:`,
        error
      );
      return null;
    }

    const response = data.accountAssetBalanceHistoricalData.nodes[0];
    if (response)
      await this.mainIndexerCacheProvider.setAccountAssetBalanceHistDataAtBlock({
        address: accountPubKey,
        assetId,
        blockHeight,
        entity: response,
      });

    return response || null;
  }

  async fetchAavepool({
    id,
    aTokenId,
    reserveAssetId,
    endpoint = ApiEndpoint.MAIN_INDEXER_API,
  }: {
    id?: string;
    aTokenId?: string;
    reserveAssetId?: string;
    endpoint?: ApiEndpoint;
  }): Promise<DatasourceAavepool | null> {
    if (!id && !aTokenId && !reserveAssetId) {
      this.logger.error(`Failed to fetch aavepool due to invalid params`);
      return null;
    }

    const cachedData =
      (await this.mainIndexerCacheProvider.getAavepool(id)) ||
      (await this.mainIndexerCacheProvider.getAavepool(aTokenId)) ||
      (await this.mainIndexerCacheProvider.getAavepool(reserveAssetId));
    if (cachedData) return cachedData;

    const { data, error } = await this.graphqlClientProvider.gqlRequest<
      GetAavepoolQuery,
      GetAavepoolQueryVariables
    >({
      query: GetAavepool,
      variables: {
        filter: {
          ...(id && { id: { equalTo: id } }),
          ...(aTokenId && { aTokenId: { equalTo: aTokenId } }),
          ...(reserveAssetId && { reserveAssetId: { equalTo: reserveAssetId } }),
        },
      },
      endpoint,
    });

    if (error) {
      this.logger.error(`Failed to fetch aavepool:`, error);
      return null;
    }

    const response = data.aavepools.nodes[0];

    if (response) {
      await this.mainIndexerCacheProvider.setAavepool(response.id, response);
      await this.mainIndexerCacheProvider.setAavepool(response.aTokenId, response);
      await this.mainIndexerCacheProvider.setAavepool(response.reserveAssetId, response);
    }

    return response || null;
  }

  async fetchAavepoolHistoricalDataAtBlock({
    poolId,
    blockHeight,
    endpoint = ApiEndpoint.MAIN_INDEXER_API,
  }: {
    poolId: string;
    blockHeight: number;
    endpoint?: ApiEndpoint;
  }): Promise<DatasourceAavepoolHistoricalData | null> {
    const { data, error } = await this.graphqlClientProvider.gqlRequest<
      GetAavepoolHistDataAtBlockQuery,
      GetAavepoolHistDataAtBlockQueryVariables
    >({
      query: GetAavepoolHistDataAtBlock,
      variables: {
        first: 1,
        orderBy: AavepoolHistoricalDataOrderBy.ParaBlockHeightDesc,
        filter: {
          poolId: { equalTo: poolId },
          paraBlockHeight: { lessThanOrEqualTo: blockHeight },
        },
      },
      endpoint,
    });

    if (error) {
      this.logger.error(`Failed to fetch aavepool historical data:`, error);
      return null;
    }

    return data.aavepoolHistoricalData.nodes[0] || null;
  }

  async fetchPoolByAccount({
    accountPubKey,
    endpoint = ApiEndpoint.MAIN_INDEXER_API,
  }: {
    accountPubKey: string;
    endpoint?: ApiEndpoint;
  }): Promise<DatasourceAccountData | null> {
    const cachedData = await this.mainIndexerCacheProvider.getAccount(accountPubKey);
    if (cachedData) return cachedData;

    const { data, error } = await this.graphqlClientProvider.gqlRequest<
      GetPoolByAccountQuery,
      GetPoolByAccountQueryVariables
    >({
      query: GetPoolByAccount,
      variables: {
        filter: {
          id: { equalTo: accountPubKey },
        },
      },
      endpoint,
    });

    if (error) {
      this.logger.error(`Failed to fetch pool by account:`, error);
      return null;
    }

    const response = data.accounts.nodes[0];
    if (response) await this.mainIndexerCacheProvider.setAccount(accountPubKey, response);

    return response || null;
  }

  mergeSplittedSwaps(rawSwapsList: DatasourceSwap[]): DatasourceSwap[] {
    const swapsIndexedByTraceId: Map<string, DatasourceSwap[]> = new Map();

    for (const rawSwap of rawSwapsList) {
      if (!swapsIndexedByTraceId.has(rawSwap.event.traceId))
        swapsIndexedByTraceId.set(rawSwap.event.traceId, []);
      swapsIndexedByTraceId.get(rawSwap.event.traceId).push(rawSwap);
    }

    const mergedSwaps: DatasourceSwap[] = [];

    for (const swapsBatch of swapsIndexedByTraceId.values()) {
      if (swapsBatch.length === 1) {
        mergedSwaps.push(swapsBatch[0]);
        continue;
      }
      if (swapsBatch.length > 2) {
        mergedSwaps.push(...swapsBatch);
        continue;
      }

      const [swap1, swap2] = swapsBatch.sort((a, b) => a.swapIndex - b.swapIndex);

      const mergedSwap = {
        ...swap1,
        id: swap1.id.slice(0, -3),
        swapInputs: swap1.swapInputs,
        swapOutputs: swap2.swapOutputs,
      };
      mergedSwaps.push(mergedSwap);
    }

    return mergedSwaps.sort((a, b) => {
      if (a.paraBlockHeight !== b.paraBlockHeight) {
        return a.paraBlockHeight - b.paraBlockHeight;
      }
      return a.event.indexInBlock - b.event.indexInBlock;
    });
  }
}

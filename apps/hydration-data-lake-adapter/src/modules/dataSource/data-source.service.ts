import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../config';
import { GraphqlClientProvider } from '../../providers/graphql-client.provider';
import { GraphQlClientProviderToken } from '../../providers';
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
} from './graphqlSupport/mainIndexer/apiTypes';
import { DatasourceAsset, DatasourceBlock, DatasourceSwap } from './graphqlSupport/types';
import {
  GetSwapsInBlocksRange,
  GetSwapsInBlocksRangeQuery,
  GetSwapsInBlocksRangeQueryVariables,
} from './graphqlSupport/mainIndexer/apiTypes';

@Injectable()
export class DataSourceService {
  private readonly logger = new Logger(DataSourceService.name, { timestamp: true });

  constructor(
    private appConfig: AppConfig,

    @Inject(GraphQlClientProviderToken)
    private graphqlClientProvider: GraphqlClientProvider
  ) {}

  async getBlocksByHeightsList({
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

  async getLatestProcessedBlock({
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

  async getAssetById({
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

  async getSwapsInBlocksRange({
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
        // TODO fix types
        // @ts-ignore
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
}

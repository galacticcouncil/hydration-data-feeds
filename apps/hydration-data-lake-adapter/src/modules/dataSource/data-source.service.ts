import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../config';
import { GraphqlClientProvider } from '../../providers/graphql-client.provider';
import { GraphQlClientProviderToken } from '../../providers';
import { ApiEndpoint } from './types';
import {
  GetLatestStableswapLiquidityEventWithBlock,
  GetLatestStableswapLiquidityEventWithBlockQuery,
  GetLatestStableswapLiquidityEventWithBlockQueryVariables,
  GetLatestSwapWithBlock,
  GetLatestSwapWithBlockQuery,
  GetLatestSwapWithBlockQueryVariables,
  StableswapLiquidityEventsOrderBy,
  SwapsOrderBy,
} from './graphqlSupport/main/apiTypes';
import { DatasourceBlock } from './graphqlSupport/types';

@Injectable()
export class DataSourceService {
  private readonly logger = new Logger(DataSourceService.name, { timestamp: true });

  constructor(
    private appConfig: AppConfig,

    @Inject(GraphQlClientProviderToken)
    private graphqlClientProvider: GraphqlClientProvider
  ) {}

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
}

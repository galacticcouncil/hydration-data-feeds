import { Injectable, Logger } from '@nestjs/common';

import { GraphqlClientService } from '../../graphql-client/graphql-client.service';
import { GET_PEPL_LIQUIDATION_EVENTS_QUERY } from '../../graphql-client/queries/pepl-liquidation.queries';
import {
  GetPeplLiquidationEventsResponse,
  PeplLiquidationEventNode,
} from '../../graphql-client/types/graphql-response.types';

export interface FetchedPeplData {
  events: PeplLiquidationEventNode[];
  totalCount: number;
}

/**
 * Service responsible for fetching PEPL liquidation events from GraphQL
 * Uses pagination-based approach for efficient data retrieval
 */
@Injectable()
export class PeplLiquidationFetcherService {
  private readonly logger = new Logger(PeplLiquidationFetcherService.name);

  constructor(private graphqlClient: GraphqlClientService) {}

  /**
   * Fetch PEPL liquidation events from liquidationLiquidatedEvents table using pagination
   * Fetches events where protocol profits from liquidation
   *
   * Strategy: Pagination-based fetching (more efficient than block range filtering)
   * - Filter: paraBlockHeight > fromBlock
   * - Order: paraBlockHeight ASC, id ASC
   * - Limit: batchSize records per query
   *
   * @param fromBlock - Last processed block (exclusive - will fetch > fromBlock)
   * @param batchSize - Number of events to fetch per batch (default: 500)
   * @returns PEPL liquidation events
   */
  async fetchPeplLiquidationEvents(
    fromBlock: number,
    batchSize: number = 500,
  ): Promise<FetchedPeplData> {
    this.logger.debug(
      `Fetching PEPL liquidations after block ${fromBlock} (limit: ${batchSize})`,
    );

    const variables = {
      fromBlock,
      first: batchSize,
    };

    try {
      const response =
        await this.graphqlClient.query<GetPeplLiquidationEventsResponse>(
          GET_PEPL_LIQUIDATION_EVENTS_QUERY,
          variables,
        );

      const events = response.liquidationLiquidatedEvents.nodes;
      const totalCount = response.liquidationLiquidatedEvents.totalCount;

      this.logger.log(
        `Fetched ${events.length} PEPL liquidation events (total: ${totalCount})`,
      );

      return { events, totalCount };
    } catch (error) {
      this.logger.error(
        `Failed to fetch PEPL liquidations after block ${fromBlock}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Extract unique block heights from PEPL events
   * Used for batch-fetching asset prices
   *
   * @param events - Array of PEPL liquidation events
   * @returns Sorted array of unique block heights
   */
  extractUniqueBlockHeights(events: PeplLiquidationEventNode[]): number[] {
    const blockSet = new Set<number>();
    events.forEach((event) => blockSet.add(event.paraBlockHeight));
    return Array.from(blockSet).sort((a, b) => a - b);
  }

  /**
   * Get highest block height from batch of events
   * Used for state tracking
   *
   * @param events - Array of PEPL liquidation events
   * @returns Highest block height in batch
   */
  getMaxBlockHeight(events: PeplLiquidationEventNode[]): number {
    return Math.max(...events.map((e) => e.paraBlockHeight));
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { GraphqlClientService } from '../../graphql-client/graphql-client.service';
import { GET_ASSET_RESERVE_EVENTS_QUERY } from '../../graphql-client/queries/asset-reserve.queries';
import {
  AssetReserveEventNode,
  GetAssetReserveEventsResponse,
} from '../../graphql-client/types/graphql-response.types';

export interface FetchedAssetReserveData {
  events: AssetReserveEventNode[];
}

@Injectable()
export class AssetReserveFetcherService {
  private readonly logger = new Logger(AssetReserveFetcherService.name);

  constructor(private graphqlClient: GraphqlClientService) {}

  /**
   * Fetch Asset Reserve events from mmMintedToTreasuryEvents table using pagination
   * Fetches events where assets are minted to the treasury
   *
   * Strategy: Pagination-based fetching (more efficient than block range filtering)
   * - Filter: paraBlockHeight > fromBlock
   * - Order: paraBlockHeight ASC, id ASC
   * - Limit: batchSize records per query
   *
   * @param fromBlock - Last processed block (exclusive - will fetch > fromBlock)
   * @param batchSize - Number of events to fetch per batch (default: 500)
   * @returns Asset Reserve events
   */
  async fetchAssetReserveEvents(
    fromBlock: number,
    batchSize: number = 500,
  ): Promise<FetchedAssetReserveData> {
    this.logger.debug(
      `Fetching Asset Reserve events after block ${fromBlock} (limit: ${batchSize})`,
    );

    const variables = {
      fromBlock,
      first: batchSize,
    };

    try {
      const response =
        await this.graphqlClient.query<GetAssetReserveEventsResponse>(
          GET_ASSET_RESERVE_EVENTS_QUERY,
          variables,
        );

      const events = response.mmMintedToTreasuryEvents.nodes;

      this.logger.log(`Fetched ${events.length} Asset Reserve events`);

      return { events };
    } catch (error) {
      this.logger.error(
        `Failed to fetch Asset Reserve events from block ${fromBlock}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Extract unique block heights from Asset Reserve events
   * Used for batch-fetching asset prices
   *
   * @param events - Array of Asset Reserve events
   * @returns Sorted array of unique block heights
   */
  extractUniqueBlockHeights(events: AssetReserveEventNode[]): number[] {
    const blockSet = new Set<number>();
    events.forEach(event => blockSet.add(event.paraBlockHeight));
    return Array.from(blockSet).sort((a, b) => a - b);
  }

  /**
   * Get highest block height from batch of events
   * Used for state tracking
   *
   * @param events - Array of Asset Reserve events
   * @returns Highest block height in batch
   */
  getMaxBlockHeight(events: AssetReserveEventNode[]): number {
    return Math.max(...events.map(e => e.paraBlockHeight));
  }
}

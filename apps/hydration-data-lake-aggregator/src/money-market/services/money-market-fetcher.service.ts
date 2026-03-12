import { Injectable, Logger } from '@nestjs/common';

import { GraphqlClientService } from '../../graphql-client/services/graphql-client.service';
import { MONEY_MARKET_TREASURY_ADDRESS } from '../../common/constants/blockchain-addresses.constants';
import {
  GET_LIQUIDATION_EVENTS_QUERY,
  GET_TREASURY_TRANSFERS_QUERY,
} from '../../graphql-client/queries/money-market.queries';
import {
  GetLiquidationEventsResponse,
  GetTreasuryTransfersResponse,
  LiquidationEventNode,
  TransferNode,
} from '../../graphql-client/types/graphql-response.types';
import { FetchResult } from '../../common/interfaces/paginated-response.interface';

/**
 * Service responsible for fetching money market data from GraphQL
 * Implements liquidation-first processing strategy:
 * 1. Fetch liquidations directly (minimal data)
 * 2. Fetch treasury transfers for specific blocks in batch
 */
@Injectable()
export class MoneyMarketFetcherService {
  private readonly logger = new Logger(MoneyMarketFetcherService.name);

  private readonly TREASURY_ADDRESS = MONEY_MARKET_TREASURY_ADDRESS;

  // Zero address to exclude (transfers from zero are mints, not fees)
  private readonly ZERO_ADDRESS =
    '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000';

  constructor(private graphqlClient: GraphqlClientService) {}

  /**
   * Fetch liquidation events from moneyMarketEvents table
   * Only fetches minimal data needed for fee tracking:
   * - eventId: for temporal ordering
   * - paraBlockHeight: to query transfers
   * - paraTimestamp: for timeseries bucketing
   * - liquidationCallId: for reference/debugging
   *
   * @param fromBlock - Start block (exclusive - will fetch > fromBlock)
   * @param batchSize - Number of liquidations to fetch (default: 100)
   * @returns Liquidation events with minimal data
   */
  async fetchLiquidations(
    fromBlock: number,
    batchSize: number = 100,
  ): Promise<FetchResult<LiquidationEventNode>> {
    this.logger.debug(
      `Fetching liquidations from block ${fromBlock} (limit: ${batchSize})`,
    );

    const variables = {
      fromBlock,
      first: batchSize,
    };

    try {
      const response =
        await this.graphqlClient.query<GetLiquidationEventsResponse>(
          GET_LIQUIDATION_EVENTS_QUERY,
          variables,
        );

      this.logger.log(
        `Fetched ${response.moneyMarketEvents.nodes.length} liquidations (total: ${response.moneyMarketEvents.totalCount})`,
      );

      return {
        items: response.moneyMarketEvents.nodes,
        totalCount: response.moneyMarketEvents.totalCount,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch liquidations from block ${fromBlock}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Fetch treasury transfers directly from transfers table
   * Applies all filters server-side for maximum efficiency:
   * - Block heights via IN operator (batch query)
   * - Treasury address filter (toId includes)
   * - Zero address exclusion (fromId not equal to)
   *
   * This is MUCH more efficient than:
   * 1. Fetching all transfers and filtering client-side
   * 2. Querying moneyMarketEvents (uses transfers table directly)
   *
   * @param blockHeights - Array of block heights to query
   * @returns Treasury transfers for those blocks
   */
  async fetchTreasuryTransfers(
    blockHeights: number[],
  ): Promise<TransferNode[]> {
    if (blockHeights.length === 0) {
      return [];
    }

    this.logger.debug(
      `Fetching treasury transfers for ${blockHeights.length} blocks`,
    );

    const variables = {
      blockHeights,
      treasuryAddress: this.TREASURY_ADDRESS,
      zeroAddress: this.ZERO_ADDRESS,
    };

    try {
      const response =
        await this.graphqlClient.query<GetTreasuryTransfersResponse>(
          GET_TREASURY_TRANSFERS_QUERY,
          variables,
        );

      const transfers = response.transfers.nodes;

      this.logger.debug(
        `Fetched ${transfers.length} treasury transfers for ${blockHeights.length} blocks`,
      );

      return transfers;
    } catch (error) {
      this.logger.error(
        `Failed to fetch treasury transfers for ${blockHeights.length} blocks`,
        error.stack,
      );
      throw error;
    }
  }


  /**
   * Extract unique asset IDs from treasury transfers
   * Used to fetch spot prices for fee enrichment
   *
   * @param transfers - Array of transfer nodes
   * @returns Array of unique asset IDs
   */
  extractUniqueAssetIds(transfers: TransferNode[]): string[] {
    const assetIdSet = new Set<string>();

    transfers.forEach((transfer) => {
      assetIdSet.add(transfer.assetId);
    });

    return Array.from(assetIdSet);
  }
}

import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  GET_ASSET_PRICES_AT_BLOCK_QUERY,
  GET_NEAREST_ASSET_PRICES_QUERY,
} from '../../graphql-client/queries/swaps.queries';
import {
  GraphqlClientService,
} from '../../graphql-client/services/graphql-client.service';
import {
  AssetSpotPriceNode,
  GetAssetPricesAtBlockResponse,
} from '../../graphql-client/types/graphql-response.types';
import { AssetRegistryService } from './asset-registry.service';

export interface AssetPriceMap {
  [assetId: string]: string; // assetId -> priceNormalised
}

@Injectable()
export class PriceFetcherService {
  private readonly logger = new Logger(PriceFetcherService.name);
  private readonly pricelessAssetsWarned = new Set<string>();

  constructor(
    private readonly graphqlClient: GraphqlClientService,
    private readonly configService: ConfigService,
    private readonly assetRegistry: AssetRegistryService,
  ) {}

  /**
   * Fetch asset USD prices at a specific block height
   */
  async fetchAssetPricesAtBlock(
    assetIds: string[],
    blockHeight: number,
  ): Promise<AssetPriceMap> {
    if (assetIds.length === 0) return {};

    const response = await this.graphqlClient.query<GetAssetPricesAtBlockResponse>(
      GET_ASSET_PRICES_AT_BLOCK_QUERY,
      { assetIds, blockHeight },
    );

    const priceMap: AssetPriceMap = {};
    response.assetSpotPriceHistoricalData.nodes.forEach((priceNode) => {
      priceMap[priceNode.assetInId] = priceNode.priceNormalised;
    });

    return priceMap;
  }

  /**
   * Fetch nearest historical asset prices at or before a given block height.
   *
   * Two-pass strategy: first request covers all assets with a 500-row budget. High-frequency
   * assets can crowd out low-frequency ones in that window, so any assets not covered in the
   * first pass get a dedicated second request where all 500 rows belong to them alone.
   */
  async fetchNearestAssetPrices(
    assetIds: string[],
    blockHeight: number,
  ): Promise<AssetPriceMap> {
    if (assetIds.length === 0) return {};

    this.logger.debug(
      `Fetching nearest prices for ${assetIds.length} assets at or before block ${blockHeight}`,
    );

    const spotPriceBaseAssetId: string = this.configService.get(
      'price.spotPriceBaseAssetId',
    )!;

    try {
      const priceMap = await this.fetchNearestPricesOnce(assetIds, blockHeight);

      // Second pass for assets not covered (excluding base asset — always set to 1:1 below)
      const missingAssetIds = assetIds.filter(
        (id) => !priceMap[id] && id !== spotPriceBaseAssetId,
      );

      if (missingAssetIds.length > 0) {
        this.logger.debug(
          `Re-fetching prices for ${missingAssetIds.length} assets not covered in first pass`,
        );
        const fallbackMap = await this.fetchNearestPricesOnce(missingAssetIds, blockHeight);
        Object.assign(priceMap, fallbackMap);
      }

      if (assetIds.includes(spotPriceBaseAssetId) && !priceMap[spotPriceBaseAssetId]) {
        priceMap[spotPriceBaseAssetId] = '1';
      }

      this.logger.debug(
        `Fetched nearest prices for ${Object.keys(priceMap).length}/${assetIds.length} assets`,
      );

      return priceMap;
    } catch (error) {
      this.logger.error(
        `Failed to fetch nearest asset prices for block ${blockHeight}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Fetch prices for a set of assets and build a complete price map with '0' fallback for missing assets.
   * For aTokens with no direct price history, falls back to the underlying asset's price.
   */
  async buildBatchPriceMap(
    assetIds: string[],
    blockHeight: number,
  ): Promise<AssetPriceMap> {
    if (assetIds.length === 0) return {};

    try {
      const fetchedPrices = await this.fetchNearestAssetPrices(assetIds, blockHeight);

      // For assets with no price, fall back to the underlying token price (aTokens)
      const missingIds = assetIds.filter((id) => !fetchedPrices[id]);
      if (missingIds.length > 0) {
        const aTokenFallbacks = new Map<string, string>(); // aTokenId -> underlyingId
        const underlyingToFetch = new Set<string>();

        for (const id of missingIds) {
          const underlyingId = this.assetRegistry.getUnderlyingAssetId(id);
          if (underlyingId) {
            aTokenFallbacks.set(id, underlyingId);
            if (!fetchedPrices[underlyingId]) {
              underlyingToFetch.add(underlyingId);
            }
          }
        }

        if (underlyingToFetch.size > 0) {
          const underlyingPrices = await this.fetchNearestAssetPrices(
            Array.from(underlyingToFetch),
            blockHeight,
          );
          Object.assign(fetchedPrices, underlyingPrices);
        }

        for (const [aTokenId, underlyingId] of aTokenFallbacks) {
          if (fetchedPrices[underlyingId]) {
            fetchedPrices[aTokenId] = fetchedPrices[underlyingId];
            this.logger.debug(
              `Using underlying asset ${underlyingId} price for aToken ${aTokenId}`,
            );
          }
        }
      }

      // Warn once for assets still missing after the aToken fallback
      const stillMissing = assetIds.filter((id) => !fetchedPrices[id]);
      if (stillMissing.length > 0) {
        const newMissing = stillMissing.filter((id) => !this.pricelessAssetsWarned.has(id));
        newMissing.forEach((id) => this.pricelessAssetsWarned.add(id));
        if (newMissing.length > 0) {
          this.logger.warn(
            `Assets with no historical prices (first occurrence — all batches will use usd_value='0'): ${newMissing.join(', ')}`,
          );
        }
      }

      return Object.fromEntries(assetIds.map((id) => [id, fetchedPrices[id] || '0']));
    } catch (error) {
      this.logger.error(
        `Failed to fetch batch prices for block ${blockHeight}: ${error.message}`,
      );
      return Object.fromEntries(assetIds.map((id) => [id, '0']));
    }
  }

  private async fetchNearestPricesOnce(
    assetIds: string[],
    blockHeight: number,
  ): Promise<AssetPriceMap> {
    const response = await this.graphqlClient.query<GetAssetPricesAtBlockResponse>(
      GET_NEAREST_ASSET_PRICES_QUERY,
      { assetIds, blockHeight },
    );

    const assetPricesByBlock = new Map<string, AssetSpotPriceNode>();
    response.assetSpotPriceHistoricalData.nodes.forEach((priceNode) => {
      const existing = assetPricesByBlock.get(priceNode.assetInId);
      if (!existing || priceNode.paraBlockHeight > existing.paraBlockHeight) {
        assetPricesByBlock.set(priceNode.assetInId, priceNode);
      }
    });

    const priceMap: AssetPriceMap = {};
    assetPricesByBlock.forEach((priceNode, assetId) => {
      priceMap[assetId] = priceNode.priceNormalised;
    });

    return priceMap;
  }
}

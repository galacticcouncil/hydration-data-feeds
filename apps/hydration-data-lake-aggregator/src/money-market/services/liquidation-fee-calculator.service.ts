import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  AssetRegistryService,
} from '../../common/services/asset-registry.service';
import {
  addNormalizedAmounts,
  normalizeAmount,
} from '../../common/utils/amount.utils';
import { ZERO_ADDRESS_HEX } from '../../common/constants/blockchain-addresses.constants';
import {
  LiquidationEventNode,
  TransferNode,
} from '../../graphql-client/types/graphql-response.types';

export interface FeeByTransfer {
  fromId: string;
  toId: string;
  assetId: string;
  amount: string; // Normalized amount as string (human-readable)
  feeType: 'LIQUIDATION_PENALTY' | 'OTHER';
  transferEventId: string;
}

export interface LiquidationFees {
  liquidationEventId: string;
  blockHeight: number;
  timestamp: string;
  liquidationCallId: string;
  treasuryTransfers: FeeByTransfer[];
  feeAmountsRaw: Record<string, string>; // { assetId: totalAmount }
  feeAssetIds: string[];
}

/**
 * Service responsible for calculating liquidation fees from treasury transfers
 * Implements the core logic from track-liquidation-treasury-fees.ts script
 */
@Injectable()
export class LiquidationFeeCalculatorService {
  private readonly logger = new Logger(LiquidationFeeCalculatorService.name);
  private readonly ZERO_ADDRESS = ZERO_ADDRESS_HEX;

  constructor(private readonly assetRegistry: AssetRegistryService) {}

  /**
   * Calculate fees for a single liquidation
   * Finds all treasury transfers that occur BEFORE the liquidation event
   * NOW ASYNC - fetches decimals from asset registry and normalizes amounts
   *
   * Strategy:
   * 1. Filter transfers in the same block as liquidation
   * 2. Only include transfers where eventId < liquidationEventId (before liquidation)
   * 3. Fetch decimals for all assets
   * 4. Normalize amounts by dividing by 10^decimals
   * 5. Aggregate by asset
   * 6. Get timestamp from the first transfer (all transfers in same block have same timestamp)
   *
   * @param liquidation - The liquidation event
   * @param transfersInBlock - All treasury transfers in the same block
   * @returns Liquidation fees or null if no fees found
   */
  async calculateLiquidationFees(
    liquidation: LiquidationEventNode,
    transfersInBlock: TransferNode[],
  ): Promise<LiquidationFees | null> {
    // Filter transfers that occur BEFORE this liquidation
    const transfersBeforeLiquidation = transfersInBlock.filter(
      (transfer) =>
        transfer.paraBlockHeight === liquidation.paraBlockHeight &&
        transfer.eventId < liquidation.eventId,
    );

    if (transfersBeforeLiquidation.length === 0) {
      return null; // No fees for this liquidation
    }

    // Get timestamp from first transfer (all transfers in same block have same timestamp)
    const timestamp = transfersBeforeLiquidation[0].paraTimestamp;

    // Extract unique asset IDs for batch decimal lookup
    const assetIds = [
      ...new Set(transfersBeforeLiquidation.map((t) => t.assetId)),
    ];
    const decimalsMap = await this.assetRegistry.getDecimalsBatch(assetIds);

    // Build fee_by_transfer array with normalized amounts
    // If fromId is zero address, it's minting (OTHER), otherwise it's a liquidation penalty
    const feeByTransfer: FeeByTransfer[] = [];

    for (const transfer of transfersBeforeLiquidation) {
      // Get decimals from registry (batch fetched above)
      let decimals: number | undefined = decimalsMap.get(transfer.assetId);

      if (decimals === undefined) {
        // Fallback: try individual lookup
        const fetchedDecimals = await this.assetRegistry.getDecimals(
          transfer.assetId,
        );

        if (fetchedDecimals === null) {
          this.logger.warn(
            `Decimals not found for asset ${transfer.assetId}, defaulting to 1`,
          );
          decimals = 1;
        } else {
          decimals = fetchedDecimals;
        }
      }

      // Normalize amount by dividing by 10^decimals
      const normalizedAmount = normalizeAmount(transfer.amount, decimals);

      feeByTransfer.push({
        fromId: transfer.fromId,
        toId: transfer.toId,
        assetId: transfer.assetId,
        amount: normalizedAmount,
        feeType:
          transfer.fromId === this.ZERO_ADDRESS
            ? ('OTHER' as const)
            : ('LIQUIDATION_PENALTY' as const),
        transferEventId: transfer.eventId,
      });
    }

    // Aggregate normalized fees by asset
    const feeAmountsRaw: Record<string, string> = {};
    const assetIdSet = new Set<string>();

    feeByTransfer.forEach((fee) => {
      assetIdSet.add(fee.assetId);

      if (feeAmountsRaw[fee.assetId]) {
        feeAmountsRaw[fee.assetId] = addNormalizedAmounts(
          feeAmountsRaw[fee.assetId],
          fee.amount,
        );
      } else {
        feeAmountsRaw[fee.assetId] = fee.amount;
      }
    });

    const feeAssetIds = Array.from(assetIdSet);

    this.logger.debug(
      `Liquidation ${liquidation.eventId}: Found ${transfersBeforeLiquidation.length} treasury transfers, ${feeAssetIds.length} unique assets`,
    );

    return {
      liquidationEventId: liquidation.eventId,
      blockHeight: liquidation.paraBlockHeight,
      timestamp, // From transfers table
      liquidationCallId: liquidation.liquidationCallId,
      treasuryTransfers: feeByTransfer,
      feeAmountsRaw,
      feeAssetIds,
    };
  }

  /**
   * Calculate fees for multiple liquidations using a map of block → transfers
   * This is more efficient than calling calculateLiquidationFees individually
   * NOW ASYNC - since calculateLiquidationFees is async
   *
   * @param liquidations - Array of liquidation events
   * @param transfersByBlock - Map of blockHeight → treasury transfers
   * @returns Array of liquidation fees (only for liquidations with fees)
   */
  async calculateFeesForLiquidations(
    liquidations: LiquidationEventNode[],
    transfersByBlock: Map<number, TransferNode[]>,
  ): Promise<LiquidationFees[]> {
    const liquidationsWithFees: LiquidationFees[] = [];

    for (const liquidation of liquidations) {
      const transfersInBlock =
        transfersByBlock.get(liquidation.paraBlockHeight) || [];

      const fees = await this.calculateLiquidationFees(liquidation, transfersInBlock);

      if (fees) {
        liquidationsWithFees.push(fees);
      }
    }

    this.logger.log(
      `Calculated fees for ${liquidationsWithFees.length}/${liquidations.length} liquidations`,
    );

    return liquidationsWithFees;
  }

  /**
   * Group treasury transfers by block height
   * Optimizes lookups when processing multiple liquidations
   *
   * @param transfers - Array of transfer nodes
   * @returns Map of blockHeight → transfers in that block
   */
  groupTransfersByBlock(transfers: TransferNode[]): Map<number, TransferNode[]> {
    const transfersByBlock = new Map<number, TransferNode[]>();

    transfers.forEach((transfer) => {
      const blockHeight = transfer.paraBlockHeight;
      const existing = transfersByBlock.get(blockHeight) || [];
      existing.push(transfer);
      transfersByBlock.set(blockHeight, existing);
    });

    return transfersByBlock;
  }

  /**
   * Extract all unique asset IDs from liquidation fees
   * Used for fetching spot prices during enrichment
   *
   * @param liquidationFees - Array of liquidation fees
   * @returns Array of unique asset IDs
   */
  extractUniqueAssetIds(liquidationFees: LiquidationFees[]): string[] {
    const assetIdSet = new Set<string>();

    liquidationFees.forEach((fees) => {
      fees.feeAssetIds.forEach((assetId) => {
        assetIdSet.add(assetId);
      });
    });

    return Array.from(assetIdSet);
  }

}

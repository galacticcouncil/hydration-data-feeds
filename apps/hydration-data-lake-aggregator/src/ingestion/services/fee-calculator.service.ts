import { Injectable, Logger } from '@nestjs/common';
import { SwapNode, SwapFeeNode } from '../../graphql-client/types/graphql-response.types';

export type FeeType = 'asset' | 'protocol' | 'burned';

export interface FeeByRecipient {
  recipientId: string;
  destinationType: string;
  assetId: string;
  amount: string;
  feeType: FeeType;
}

export interface CalculatedFeeData {
  feeAssetIds: string[];
  feeAmountsRaw: Record<string, string>;
  feeByRecipient: FeeByRecipient[];
}

@Injectable()
export class FeeCalculatorService {
  private readonly logger = new Logger(FeeCalculatorService.name);

  // Recipient ID constants
  private readonly ASSET_FEES_RECIPIENT = '0x6d6f646c726566657272616c0000000000000000000000000000000000000000';
  private readonly PROTOCOL_FEES_RECIPIENT = '0x6d6f646c70792f74727372790000000000000000000000000000000000000000';

  /**
   * Determine fee type based on recipient ID
   */
  private determineFeeType(recipientId: string | null): FeeType {
    // If recipientId is null, fees are burned
    if (!recipientId || recipientId === null) {
      return 'burned';
    }

    if (recipientId === this.ASSET_FEES_RECIPIENT) {
      return 'asset';
    } else if (recipientId === this.PROTOCOL_FEES_RECIPIENT) {
      return 'protocol';
    }

    // Default to protocol for unknown recipients
    return 'protocol';
  }

  /**
   * Calculate fee data for a swap
   * Aggregates all fee amounts and tracks fee distribution by recipient and fee type
   * Normalizes amounts by dividing by asset decimals to store human-readable values
   */
  calculateSwapFees(swap: SwapNode): CalculatedFeeData {
    const feeAmountsRaw: Record<string, string> = {};
    const feeAssetIds: string[] = [];
    const feeByRecipient: FeeByRecipient[] = [];

    // Process each fee in the swap
    swap.swapFees.nodes.forEach((fee: SwapFeeNode) => {
      const assetId = fee.assetId;
      const rawAmount = fee.amount;

      // Get decimals, default to 1 if not found and log warning
      let decimals = 1;
      if (fee.asset?.decimals) {
        decimals = fee.asset.decimals;
      } else {
        this.logger.warn(`Decimals not found for asset ${assetId}, defaulting to 1`);
      }

      // Normalize amount by dividing by 10^decimals
      const normalizedAmount = this.normalizeAmount(rawAmount, decimals);

      // Store normalized amount (aggregate if multiple fees in same asset)
      if (feeAmountsRaw[assetId]) {
        feeAmountsRaw[assetId] = this.addDecimalNumbers(
          feeAmountsRaw[assetId],
          normalizedAmount,
        );
      } else {
        feeAmountsRaw[assetId] = normalizedAmount;
        feeAssetIds.push(assetId);
      }

      // Determine fee type
      const feeType = this.determineFeeType(fee.recipientId);

      // Track fee by recipient (with normalized amount)
      feeByRecipient.push({
        recipientId: fee.recipientId,
        destinationType: fee.destinationType,
        assetId: fee.assetId,
        amount: normalizedAmount,
        feeType,
      });
    });

    return {
      feeAssetIds,
      feeAmountsRaw,
      feeByRecipient,
    };
  }

  /**
   * Normalize amount by dividing by 10^decimals
   * Converts raw blockchain value to human-readable amount
   * Example: 1500000000000 with 12 decimals -> "1.5"
   */
  private normalizeAmount(rawAmount: string, decimals: number): string {
    try {
      const amount = BigInt(rawAmount);
      const divisor = BigInt(10 ** decimals);

      // Integer division
      const integerPart = amount / divisor;

      // Remainder for decimal part
      const remainder = amount % divisor;

      // Convert remainder to decimal string
      const decimalPart = remainder.toString().padStart(decimals, '0');

      // Trim trailing zeros
      const trimmedDecimal = decimalPart.replace(/0+$/, '');

      if (trimmedDecimal.length === 0) {
        return integerPart.toString();
      }

      return `${integerPart}.${trimmedDecimal}`;
    } catch (error) {
      this.logger.error(
        `Error normalizing amount: ${rawAmount} with ${decimals} decimals`,
        error.stack,
      );
      return '0';
    }
  }

  /**
   * Add two decimal number strings
   */
  private addDecimalNumbers(a: string, b: string): string {
    try {
      const aNum = parseFloat(a);
      const bNum = parseFloat(b);
      return (aNum + bNum).toString();
    } catch (error) {
      this.logger.error(`Error adding decimal numbers: ${a} + ${b}`, error.stack);
      return a;
    }
  }

  /**
   * Calculate batch statistics for multiple swaps
   * Returns aggregated statistics
   */
  calculateBatchStatistics(swaps: SwapNode[]): {
    totalSwaps: number;
    totalFeeAssets: number;
  } {
    const uniqueAssets = new Set<string>();

    swaps.forEach((swap) => {
      const feeData = this.calculateSwapFees(swap);
      feeData.feeAssetIds.forEach((assetId) => uniqueAssets.add(assetId));
    });

    return {
      totalSwaps: swaps.length,
      totalFeeAssets: uniqueAssets.size,
    };
  }
}

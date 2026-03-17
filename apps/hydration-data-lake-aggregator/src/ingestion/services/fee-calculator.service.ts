import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  AssetRegistryService,
} from '../../common/services/asset-registry.service';
import { NestedSwapNode, SwapFeeNode } from '../../graphql-client/types/graphql-response.types';
import {
  isRoutedTradeNode,
  SwapOrRoutedTradeNode,
} from './graphql-fetcher.service';

export type FeeType = 'asset_referral' | 'asset_omnipool' | 'asset_staking' | 'protocol_treasury' | 'protocol_burned';

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
  // Asset fees are split between referral, omnipool, and staking
  private readonly ASSET_FEES_REFERRAL_RECIPIENT =
    '0x6d6f646c726566657272616c0000000000000000000000000000000000000000'; // modlreferral
  private readonly ASSET_FEES_OMNIPOOL_RECIPIENT =
    '0x6d6f646c6f6d6e69706f6f6c0000000000000000000000000000000000000000'; // modlomnipool
  private readonly ASSET_FEES_STAKING_RECIPIENT =
    '0x6d6f646c7374616b696e67230000000000000000000000000000000000000000'; // modlstaking#

  // Protocol fees are split 50/50 between treasury and burned
  private readonly PROTOCOL_FEES_TREASURY_RECIPIENT =
    '0x6d6f646c70792f74727372790000000000000000000000000000000000000000'; // modlpy/trsry

  // H2O asset ID - special handling for protocol fees
  private readonly H2O_ASSET_ID = '1';

  /**
   * Feature flag: when true, the H2O input amount is attributed to the omnipool
   * as a synthetic protocol_treasury fee entry for post-upgrade routed trades.
   * Set to false to keep the detection/calculation logic without counting it.
   * Re-enable by setting this to true (or wiring to config) when ready.
   */
  private readonly H2O_OMNIPOOL_ATTRIBUTION_ENABLED = false;

  constructor(
    private readonly assetRegistry: AssetRegistryService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Determine fee type based on recipient ID (PRE-UPGRADE LOGIC)
   * Used for blocks < OMNIPOOL_RUNTIME_UPGRADE_BLOCK
   *
   * Fee Distribution:
   * - Asset fees: to referral (asset_referral), omnipool (asset_omnipool), or staking (asset_staking)
   * - Protocol fees: 50% to treasury (protocol_treasury), 50% burned (protocol_burned)
   *
   * Returns null for unknown recipients (which will be filtered out)
   */
  private determineFeeTypePreUpgrade(recipientId: string | null): FeeType | null {
    // If recipientId is null, fees are burned (50% of protocol fees)
    if (!recipientId || recipientId === null) {
      return 'protocol_burned';
    }

    // Asset fee to referral account
    if (recipientId === this.ASSET_FEES_REFERRAL_RECIPIENT) {
      return 'asset_referral';
    }

    // Asset fee to omnipool account
    if (recipientId === this.ASSET_FEES_OMNIPOOL_RECIPIENT) {
      return 'asset_omnipool';
    }

    // Asset fee to staking account
    if (recipientId === this.ASSET_FEES_STAKING_RECIPIENT) {
      return 'asset_staking';
    }

    // Protocol fee to treasury (50% of protocol fees)
    if (recipientId === this.PROTOCOL_FEES_TREASURY_RECIPIENT) {
      return 'protocol_treasury';
    }

    // Unknown recipient - return null to skip this fee
    return null;
  }

  /**
   * Determine fee type based on new classification rules (POST-UPGRADE LOGIC)
   * Used for blocks >= OMNIPOOL_RUNTIME_UPGRADE_BLOCK
   *
   * New Rules:
   * 1. If swapFees.length == 1: classify as protocol fees (treasury + 0 burned for consistency)
   * 2. If swapFees.length == 2: classify as asset fees
   *
   * Fee Distribution:
   * - Asset fees (2 fees): Can be referral+omnipool, omnipool+staking, or referral+staking
   * - Protocol fees (1 fee): Goes to treasury, with 0 burned entry added for consistency
   */
  private determineFeeTypePostUpgrade(
    fee: SwapFeeNode,
    feeCount: number,
    allFees?: SwapFeeNode[],
    swapId?: string,
  ): FeeType {
    // Single fee = protocol fees (distributed 50/50)
    if (feeCount === 1) {
      // If recipientId is null, fees are burned
      if (!fee.recipientId) {
        return 'protocol_burned';
      }
      // Otherwise, goes to treasury
      return 'protocol_treasury';
    }

    // Two fees = asset fees
    // Possible combinations: referral+omnipool, omnipool+staking, referral+staking
    if (feeCount === 2) {
      // Use recipient ID to determine which type
      if (fee.recipientId === this.ASSET_FEES_REFERRAL_RECIPIENT) {
        return 'asset_referral';
      }
      if (fee.recipientId === this.ASSET_FEES_OMNIPOOL_RECIPIENT) {
        return 'asset_omnipool';
      }
      if (fee.recipientId === this.ASSET_FEES_STAKING_RECIPIENT) {
        return 'asset_staking';
      }
    }

    // Fallback: use pre-upgrade logic for edge cases
    // Log detailed information about the fee structure
    if (allFees) {
      const feeBreakdown = allFees.map((f) => ({
        eventId: f.id,
        assetId: f.assetId,
        amount: f.amount,
        recipientId: f.recipientId,
        destinationType: f.destinationType,
      }));
      this.logger.debug(
        `Unexpected fee configuration for swap ${swapId}: ${feeCount} fees. Fee breakdown: ${JSON.stringify(feeBreakdown, null, 2)}`,
      );
    }

    this.logger.warn(
      `Unexpected fee configuration for swap ${swapId}: ${feeCount} fees. Using fallback classification for recipientId: ${fee.recipientId}`,
    );

    return (
      this.determineFeeTypePreUpgrade(fee.recipientId) || 'protocol_treasury'
    );
  }

  /**
   * Calculate fee data for a swap or routed trade
   * NOW ASYNC - fetches decimals from asset registry
   * Block-aware: applies different fee classification rules based on block height
   * Aggregates all fee amounts and tracks fee distribution by recipient and fee type
   * Normalizes amounts by dividing by asset decimals to store human-readable values
   */
  async calculateSwapFees(
    swap: SwapOrRoutedTradeNode,
  ): Promise<CalculatedFeeData> {
    const upgradeBlock =
      this.configService.get('ingestion.omnipoolRuntimeUpgradeBlock', {
        infer: true,
      }) || 11394694;

    const isPostUpgrade = swap.paraBlockHeight >= upgradeBlock;

    const feeAmountsRaw: Record<string, string> = {};
    const feeAssetIds: string[] = [];
    const feeByRecipient: FeeByRecipient[] = [];

    // Get swap fees - handle both SwapNode and RoutedTradeNode
    // For routed trades, we need to process each nested swap separately
    let swapFeesGroups: SwapFeeNode[][];
    if (isRoutedTradeNode(swap)) {
      // For routed trades, group fees by nested swap
      swapFeesGroups = swap.swaps.nodes.map((nestedSwap) => nestedSwap.swapFees.nodes);
    } else {
      // For regular swaps, single group
      swapFeesGroups = [swap.swapFees.nodes];
    }

    // Extract unique asset IDs first for batch lookup (including H2O if needed)
    const assetIdsSet = new Set<string>();
    swapFeesGroups.forEach((feeGroup) => {
      feeGroup.forEach((fee) => assetIdsSet.add(fee.assetId));
    });

    // H2O Special Case (Post-Upgrade only): Add H2O input amount as protocol fee
    if (isPostUpgrade && isRoutedTradeNode(swap)) {
      if (swap.inputAssetIds.includes(this.H2O_ASSET_ID)) {
        assetIdsSet.add(this.H2O_ASSET_ID);
      }
    }

    const assetIds = Array.from(assetIdsSet);
    const decimalsMap = await this.assetRegistry.getDecimalsBatch(assetIds);

    // Process H2O special case FIRST (post-upgrade routed trades only)
    if (isPostUpgrade && isRoutedTradeNode(swap)) {
      if (swap.inputAssetIds.includes(this.H2O_ASSET_ID)) {
        // Find H2O input amount from nested swaps
        let h2oInputAmount = '0';
        for (const nestedSwap of swap.swaps.nodes) {
          for (const input of nestedSwap.swapInputs.nodes) {
            if (input.assetId === this.H2O_ASSET_ID) {
              h2oInputAmount = input.amount;
              break;
            }
          }
          if (h2oInputAmount !== '0') break;
        }

        if (h2oInputAmount !== '0') {
          // Get H2O decimals
          let h2oDecimals = decimalsMap.get(this.H2O_ASSET_ID) ?? 0;
          if (h2oDecimals === 0) {
            const fetchedDecimals = await this.assetRegistry.getDecimals(
              this.H2O_ASSET_ID,
            );
            h2oDecimals = fetchedDecimals ?? 12; // Default to 12 if not found
          }

          // Normalize H2O amount
          const normalizedH2OAmount = this.normalizeAmount(
            h2oInputAmount,
            h2oDecimals,
          );

          if (this.H2O_OMNIPOOL_ATTRIBUTION_ENABLED) {
            // Add to fee amounts
            if (feeAmountsRaw[this.H2O_ASSET_ID]) {
              feeAmountsRaw[this.H2O_ASSET_ID] = this.addDecimalNumbers(
                feeAmountsRaw[this.H2O_ASSET_ID],
                normalizedH2OAmount,
              );
            } else {
              feeAmountsRaw[this.H2O_ASSET_ID] = normalizedH2OAmount;
              feeAssetIds.push(this.H2O_ASSET_ID);
            }

            // Create synthetic fee entry attributing H2O input to omnipool
            feeByRecipient.push({
              recipientId: this.ASSET_FEES_OMNIPOOL_RECIPIENT,
              destinationType: 'Treasury',
              assetId: this.H2O_ASSET_ID,
              amount: normalizedH2OAmount,
              feeType: 'protocol_treasury',
            });

            this.logger.debug(
              `H2O special case: Added ${normalizedH2OAmount} H2O as protocol_treasury for routed trade ${swap.id}`,
            );
          } else {
            this.logger.debug(
              `H2O special case: Detected ${normalizedH2OAmount} H2O input for routed trade ${swap.id} — omnipool attribution disabled`,
            );
          }
        }
      }
    }

    // Process each fee group (each nested swap has its own fee classification)
    for (const swapFees of swapFeesGroups) {
      const feeCount = swapFees.length;

      for (const fee of swapFees) {
        // Determine fee type using block-aware logic
        const feeType = isPostUpgrade
          ? this.determineFeeTypePostUpgrade(fee, feeCount, swapFees, swap.id)
          : this.determineFeeTypePreUpgrade(fee.recipientId);

        // Skip fees with unknown recipients (pre-upgrade only)
        if (feeType === null) {
          continue;
        }

        const assetId = fee.assetId;
        const rawAmount = fee.amount;

        // Get decimals from registry (batch fetched above)
        let decimals: number = decimalsMap.get(assetId) ?? 0;

        if (decimals === 0) {
          // Fallback: try individual lookup
          const fetchedDecimals = await this.assetRegistry.getDecimals(assetId);

          if (fetchedDecimals === null) {
            this.logger.warn(
              `Decimals not found for asset ${assetId}, defaulting to 1`,
            );
            decimals = 1;
          } else {
            decimals = fetchedDecimals;
          }
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

        // Track fee by recipient (with normalized amount)
        feeByRecipient.push({
          recipientId: fee.recipientId,
          destinationType: fee.destinationType,
          assetId: fee.assetId,
          amount: normalizedAmount,
          feeType,
        });
      }

      // Post-upgrade consistency: Add zero-value burned entry for single protocol fee
      // This ensures consistent data structure (always have both treasury and burned)
      if (isPostUpgrade && feeCount === 1 && swapFees.length > 0) {
        const firstFee = swapFees[0];
        // Add a protocol_burned entry with amount "0" for consistency
        feeByRecipient.push({
          recipientId: null as any, // Null recipient indicates burned
          destinationType: firstFee.destinationType,
          assetId: firstFee.assetId,
          amount: '0',
          feeType: 'protocol_burned',
        });

      }
    }

    return {
      feeAssetIds,
      feeAmountsRaw,
      feeByRecipient,
    };
  }

  /**
   * Calculate fee data for a single routed trade hop (post-upgrade)
   * Processes only the fees from one nested swap, using hop.id as the identifier
   */
  async calculateHopFees(
    hop: NestedSwapNode,
    blockHeight: number,
    routedTradeInputAssetIds: string[],
  ): Promise<CalculatedFeeData> {
    const upgradeBlock =
      this.configService.get('ingestion.omnipoolRuntimeUpgradeBlock', {
        infer: true,
      }) || 11394694;

    const isPostUpgrade = blockHeight >= upgradeBlock;

    const feeAmountsRaw: Record<string, string> = {};
    const feeAssetIds: string[] = [];
    const feeByRecipient: FeeByRecipient[] = [];

    const swapFees = hop.swapFees.nodes;

    const assetIdsSet = new Set<string>(swapFees.map((fee) => fee.assetId));
    if (isPostUpgrade && routedTradeInputAssetIds.includes(this.H2O_ASSET_ID)) {
      assetIdsSet.add(this.H2O_ASSET_ID);
    }

    const decimalsMap = await this.assetRegistry.getDecimalsBatch(
      Array.from(assetIdsSet),
    );

    // H2O special case: check this hop's inputs only
    if (isPostUpgrade && routedTradeInputAssetIds.includes(this.H2O_ASSET_ID)) {
      const h2oInput = hop.swapInputs.nodes.find(
        (input) => input.assetId === this.H2O_ASSET_ID,
      );
      if (h2oInput) {
        let h2oDecimals = decimalsMap.get(this.H2O_ASSET_ID) ?? 0;
        if (h2oDecimals === 0) {
          const fetched = await this.assetRegistry.getDecimals(this.H2O_ASSET_ID);
          h2oDecimals = fetched ?? 12;
        }
        const normalizedH2OAmount = this.normalizeAmount(h2oInput.amount, h2oDecimals);
        if (this.H2O_OMNIPOOL_ATTRIBUTION_ENABLED) {
          if (feeAmountsRaw[this.H2O_ASSET_ID]) {
            feeAmountsRaw[this.H2O_ASSET_ID] = this.addDecimalNumbers(
              feeAmountsRaw[this.H2O_ASSET_ID],
              normalizedH2OAmount,
            );
          } else {
            feeAmountsRaw[this.H2O_ASSET_ID] = normalizedH2OAmount;
            feeAssetIds.push(this.H2O_ASSET_ID);
          }
          feeByRecipient.push({
            recipientId: this.ASSET_FEES_OMNIPOOL_RECIPIENT,
            destinationType: 'Treasury',
            assetId: this.H2O_ASSET_ID,
            amount: normalizedH2OAmount,
            feeType: 'protocol_treasury',
          });
          this.logger.debug(
            `H2O special case: Added ${normalizedH2OAmount} H2O as protocol_treasury for hop ${hop.id}`,
          );
        } else {
          this.logger.debug(
            `H2O special case: Detected ${normalizedH2OAmount} H2O input for hop ${hop.id} — omnipool attribution disabled`,
          );
        }
      }
    }

    const feeCount = swapFees.length;
    for (const fee of swapFees) {
      const feeType = isPostUpgrade
        ? this.determineFeeTypePostUpgrade(fee, feeCount, swapFees, hop.id)
        : this.determineFeeTypePreUpgrade(fee.recipientId);

      if (feeType === null) continue;

      const { assetId, amount: rawAmount } = fee;
      let decimals: number = decimalsMap.get(assetId) ?? 0;
      if (decimals === 0) {
        const fetchedDecimals = await this.assetRegistry.getDecimals(assetId);
        if (fetchedDecimals === null) {
          this.logger.warn(`Decimals not found for asset ${assetId}, defaulting to 1`);
          decimals = 1;
        } else {
          decimals = fetchedDecimals;
        }
      }

      const normalizedAmount = this.normalizeAmount(rawAmount, decimals);
      if (feeAmountsRaw[assetId]) {
        feeAmountsRaw[assetId] = this.addDecimalNumbers(
          feeAmountsRaw[assetId],
          normalizedAmount,
        );
      } else {
        feeAmountsRaw[assetId] = normalizedAmount;
        feeAssetIds.push(assetId);
      }

      feeByRecipient.push({
        recipientId: fee.recipientId,
        destinationType: fee.destinationType,
        assetId: fee.assetId,
        amount: normalizedAmount,
        feeType,
      });
    }

    // Post-upgrade consistency: Add zero burned entry for single protocol fee
    if (isPostUpgrade && feeCount === 1 && swapFees.length > 0) {
      const firstFee = swapFees[0];
      feeByRecipient.push({
        recipientId: null as any,
        destinationType: firstFee.destinationType,
        assetId: firstFee.assetId,
        amount: '0',
        feeType: 'protocol_burned',
      });
    }

    return { feeAssetIds, feeAmountsRaw, feeByRecipient };
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
   * NOW ASYNC - since calculateSwapFees is async
   * Works with both SwapNode and RoutedTradeNode
   */
  async calculateBatchStatistics(swaps: SwapOrRoutedTradeNode[]): Promise<{
    totalSwaps: number;
    totalFeeAssets: number;
  }> {
    const uniqueAssets = new Set<string>();

    for (const swap of swaps) {
      const feeData = await this.calculateSwapFees(swap);
      feeData.feeAssetIds.forEach((assetId) => uniqueAssets.add(assetId));
    }

    return {
      totalSwaps: swaps.length,
      totalFeeAssets: uniqueAssets.size,
    };
  }
}

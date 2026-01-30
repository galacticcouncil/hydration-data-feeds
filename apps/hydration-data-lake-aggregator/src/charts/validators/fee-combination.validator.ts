import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, Validate } from 'class-validator';

@ValidatorConstraint({ name: 'isValidFeeCombination', async: false })
export class IsValidFeeCombinationConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const obj = args.object as any;
    const { productType, feeDestination, streamType } = obj;

    // Define valid combinations
    const validCombinations = [
      // Omnipool - Liquidity Provider fees (granular)
      { productType: 'omnipool', feeDestination: 'lp', streamType: 'asset_referral' },
      { productType: 'omnipool', feeDestination: 'lp', streamType: 'asset_omnipool' },

      // Omnipool - Liquidity Provider fees (aggregated)
      { productType: 'omnipool', feeDestination: 'lp', streamType: 'asset' },

      // Omnipool - Protocol fees (granular)
      { productType: 'omnipool', feeDestination: 'protocol', streamType: 'protocol_treasury' },
      { productType: 'omnipool', feeDestination: 'protocol', streamType: 'protocol_burned' },

      // Omnipool - Protocol fees (aggregated)
      { productType: 'omnipool', feeDestination: 'protocol', streamType: 'protocol' },
      { productType: 'omnipool', feeDestination: 'protocol', streamType: 'burned' },

      // Omnipool - Total (all fees, aggregated breakdown)
      { productType: 'omnipool', feeDestination: 'total', streamType: undefined },

      // Omnipool - Total with stream type (granular breakdown by stream type)
      { productType: 'omnipool', feeDestination: 'total', streamType: 'asset' },
      { productType: 'omnipool', feeDestination: 'total', streamType: 'protocol' },

      // Money Market
      { productType: 'money-market', feeDestination: 'protocol', streamType: 'liquidation_penalty' },
      { productType: 'money-market', feeDestination: 'protocol', streamType: 'pepl_liquidation_profit' },
      { productType: 'money-market', feeDestination: 'protocol', streamType: 'asset_reserve' },
      { productType: 'money-market', feeDestination: 'total', streamType: undefined },

      // Hollar
      { productType: 'hollar', feeDestination: 'protocol', streamType: 'borrow_apr' },
      { productType: 'hollar', feeDestination: 'protocol', streamType: 'hsm_revenue' },
      { productType: 'hollar', feeDestination: 'total', streamType: undefined },
    ];

    // Check if current combination is valid
    return validCombinations.some(combo =>
      combo.productType === productType &&
      combo.feeDestination === feeDestination &&
      combo.streamType === streamType
    );
  }

  defaultMessage(args: ValidationArguments) {
    return 'Invalid filter combination. Valid combinations: ' +
      'omnipool+lp+asset_referral, omnipool+lp+asset_omnipool, omnipool+lp+asset, ' +
      'omnipool+protocol+protocol_treasury, omnipool+protocol+protocol_burned, omnipool+protocol+protocol, omnipool+protocol+burned, ' +
      'omnipool+total, omnipool+total+asset, omnipool+total+protocol, ' +
      'money-market+protocol+liquidation_penalty, money-market+protocol+pepl_liquidation_profit, money-market+protocol+asset_reserve, money-market+total, ' +
      'hollar+protocol+borrow_apr, hollar+protocol+hsm_revenue, hollar+total';
  }
}

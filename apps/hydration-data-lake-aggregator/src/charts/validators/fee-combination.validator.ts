import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, Validate } from 'class-validator';

@ValidatorConstraint({ name: 'isValidFeeCombination', async: false })
export class IsValidFeeCombinationConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const obj = args.object as any;
    const { productType, feeDestination, streamType } = obj;

    // Define valid combinations (productType → streamType → feeDestination)
    const validCombinations = [
      // Omnipool - Asset fees
      { productType: 'omnipool', streamType: 'asset', feeDestination: 'lp' },        // Referral pallet
      { productType: 'omnipool', streamType: 'asset', feeDestination: 'protocol' },   // Omnipool pallet
      { productType: 'omnipool', streamType: 'asset', feeDestination: 'total' },      // Referral + Omnipool

      // Omnipool - Protocol fees
      { productType: 'omnipool', streamType: 'protocol', feeDestination: 'protocol' }, // Treasury
      { productType: 'omnipool', streamType: 'protocol', feeDestination: 'burned' },   // Burned
      { productType: 'omnipool', streamType: 'protocol', feeDestination: 'total' },    // Treasury + Burned

      // Omnipool - Total (all fees)
      { productType: 'omnipool', streamType: 'total', feeDestination: undefined },

      // Money Market
      { productType: 'money-market', streamType: 'liquidation_penalty', feeDestination: 'protocol' },
      { productType: 'money-market', streamType: 'pepl_liquidation_profit', feeDestination: 'protocol' },
      { productType: 'money-market', streamType: 'asset_reserve', feeDestination: 'protocol' },
      { productType: 'money-market', streamType: 'total', feeDestination: undefined },

      // Hollar
      { productType: 'hollar', streamType: 'borrow_apr', feeDestination: 'protocol' },
      { productType: 'hollar', streamType: 'hsm_revenue', feeDestination: 'protocol' },
      { productType: 'hollar', streamType: 'total', feeDestination: undefined },
    ];

    // Check if current combination is valid
    return validCombinations.some(combo =>
      combo.productType === productType &&
      combo.streamType === streamType &&
      combo.feeDestination === feeDestination
    );
  }

  defaultMessage(args: ValidationArguments) {
    return 'Invalid filter combination. Valid combinations (productType+streamType+feeDestination): ' +
      'omnipool+asset+lp, omnipool+asset+protocol, omnipool+asset+total, ' +
      'omnipool+protocol+protocol, omnipool+protocol+burned, omnipool+protocol+total, ' +
      'omnipool+total, ' +
      'money-market+liquidation_penalty+protocol, money-market+pepl_liquidation_profit+protocol, money-market+asset_reserve+protocol, money-market+total, ' +
      'hollar+borrow_apr+protocol, hollar+hsm_revenue+protocol, hollar+total';
  }
}

export function IsValidFeeCombination() {
  return Validate(IsValidFeeCombinationConstraint);
}

import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, Validate } from 'class-validator';

@ValidatorConstraint({ name: 'isValidFeeCombination', async: false })
export class IsValidFeeCombinationConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const obj = args.object as any;
    const { productType, feeDestination, streamType } = obj;

    // Define valid combinations
    const validCombinations = [
      { productType: 'omnipool', feeDestination: 'protocol', streamType: 'asset' },
      { productType: 'omnipool', feeDestination: 'protocol', streamType: 'protocol' },
      { productType: 'omnipool', feeDestination: 'protocol', streamType: 'burned' },
      { productType: 'omnipool', feeDestination: 'total', streamType: undefined },
      { productType: 'money-market', feeDestination: 'protocol', streamType: 'liquidation_penalty' },
      { productType: 'money-market', feeDestination: 'protocol', streamType: 'pepl_liquidation_profit' },
      { productType: 'money-market', feeDestination: 'protocol', streamType: 'asset_reserve' },
      { productType: 'money-market', feeDestination: 'total', streamType: undefined },
      { productType: 'hollar', feeDestination: 'protocol', streamType: 'borrow_apr' },
      { productType: 'hollar', feeDestination: 'protocol', streamType: 'hsm_revenue' },
    ];

    // Check if current combination is valid
    return validCombinations.some(combo =>
      combo.productType === productType &&
      combo.feeDestination === feeDestination &&
      combo.streamType === streamType
    );
  }

  defaultMessage(args: ValidationArguments) {
    return 'Invalid filter combination. Valid combinations: omnipool+protocol+asset, omnipool+protocol+protocol, omnipool+protocol+burned, omnipool+total, money-market+protocol+liquidation_penalty, money-market+protocol+pepl_liquidation_profit, money-market+protocol+asset_reserve, money-market+total, hollar+protocol+borrow_apr, hollar+protocol+hsm_revenue';
  }
}

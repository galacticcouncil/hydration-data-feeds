import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'notZero', async: false })
export class NotZeroConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    return value !== undefined && value !== null && value.toString() !== '0';
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} cannot be zero`;
  }
}

@ValidatorConstraint({ name: 'assetInOutRequired', async: false })
export class AssetInOutRequiredConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const object = args.object as any;
    const property = args.property;

    // Check if object has at least one asset0 property (In or Out)
    const hasAsset0 = Boolean(object.asset0In) || Boolean(object.asset0Out);

    // Check if object has at least one asset1 property (In or Out)
    const hasAsset1 = Boolean(object.asset1In) || Boolean(object.asset1Out);

    // Both conditions must be true
    return hasAsset0 && hasAsset1;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Object must contain at least one asset0 property (asset0In or asset0Out) AND at least one asset1 property (asset1In or asset1Out)';
  }
}

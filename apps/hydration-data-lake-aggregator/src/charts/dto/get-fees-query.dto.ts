import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  Validate,
} from 'class-validator';

import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsValidFeeCombinationConstraint } from '../validators/fee-combination.validator';

export enum BucketSize {
  ONE_MIN = '1min',
  FIVE_MIN = '5min',
  TEN_MIN = '10min',
  THIRTY_MIN = '30min',
  ONE_HOUR = '1hour',
  SIX_HOUR = '6hour',
  TWENTY_FOUR_HOUR = '24hour',
  SEVEN_DAY = '7day',
  THIRTY_DAY = '30day',
}

export enum ProductType {
  OMNIPOOL = 'omnipool',
  MONEY_MARKET = 'money-market',
  HOLLAR = 'hollar',
}

export enum FeeDestination {
  LIQUIDITY_PROVIDER = 'lp',  // omnipool + asset only (Referral pallet)
  PROTOCOL = 'protocol',       // omnipool + asset/protocol; all money-market & hollar streams
  TOTAL = 'total',             // omnipool + asset or protocol (sum of sub-buckets)
  BURNED = 'burned',           // omnipool + protocol only (burned fees)
}

export enum StreamType {
  TOTAL = 'total',                              // Product-level total (all fees for the product)
  ASSET = 'asset',                              // Omnipool asset fees (referral + omnipool)
  PROTOCOL = 'protocol',                        // Omnipool protocol fees (treasury + burned)
  LIQUIDATION_PENALTY = 'liquidation_penalty',  // Money market
  PEPL_LIQUIDATION_PROFIT = 'pepl_liquidation_profit', // Money market
  ASSET_RESERVE = 'asset_reserve',              // Money market
  BORROW_APR = 'borrow_apr',                    // Hollar
  HSM_REVENUE = 'hsm_revenue',                  // Hollar
}

export enum HsmAggregationType {
  CUMULATIVE = 'cumulative',  // Average of cumulative balance snapshots (default)
  DELTA = 'delta',            // Difference between consecutive bucket averages
}

export class GetFeesQueryDto {
  @ApiPropertyOptional({
    enum: ProductType,
    default: ProductType.OMNIPOOL,
    description: 'Product type to query fees for',
    example: ProductType.OMNIPOOL,
  })
  @IsOptional()
  @IsEnum(ProductType)
  @Validate(IsValidFeeCombinationConstraint)
  productType?: ProductType = ProductType.OMNIPOOL;

  @ApiPropertyOptional({
    enum: BucketSize,
    default: BucketSize.ONE_HOUR,
    description: 'Time bucket size for aggregation',
    example: BucketSize.ONE_HOUR,
  })
  @IsOptional()
  @IsEnum(BucketSize)
  bucketSize?: BucketSize = BucketSize.ONE_HOUR;

  @ApiPropertyOptional({
    description: 'Start time for the query range (ISO 8601 format)',
    example: '2026-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsISO8601()
  startTime?: string;

  @ApiPropertyOptional({
    description: 'End time for the query range (ISO 8601 format)',
    example: '2026-01-31T23:59:59Z',
  })
  @IsOptional()
  @IsISO8601()
  endTime?: string;

  @ApiPropertyOptional({
    enum: FeeDestination,
    description:
      'Fee destination filter: "lp" (liquidity providers), "protocol", or "total" (all fees)',
    example: FeeDestination.TOTAL,
  })
  @IsOptional()
  @IsEnum(FeeDestination)
  feeDestination?: FeeDestination;

  @ApiPropertyOptional({
    enum: StreamType,
    description:
      'Fee stream type. Use "total" for full product breakdown, or combine with feeDestination for specific sub-buckets.',
    example: StreamType.ASSET,
  })
  @IsOptional()
  @IsEnum(StreamType)
  streamType?: StreamType;

  @ApiPropertyOptional({
    description: 'When true, replaces any negative values with 0',
    default: true,
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  decoratedData?: boolean = true;

  @ApiPropertyOptional({
    enum: HsmAggregationType,
    default: HsmAggregationType.DELTA,
    description:
      'HSM revenue aggregation type: "cumulative" (average balance) or "delta" (change between buckets). Only applies to HSM_REVENUE stream type.',
    example: HsmAggregationType.DELTA,
  })
  @IsOptional()
  @IsEnum(HsmAggregationType)
  hsmAggregationType?: HsmAggregationType = HsmAggregationType.DELTA;
}

import {
  IsEnum,
  IsISO8601,
  IsOptional,
  Validate,
} from 'class-validator';

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
}

export enum ProductType {
  OMNIPOOL = 'omnipool',
  MONEY_MARKET = 'money-market',
  HOLLAR = 'hollar',
}

export enum FeeDestination {
  LIQUIDITY_PROVIDER = 'lp',  // Asset fees (referral + omnipool)
  PROTOCOL = 'protocol',       // Protocol fees (treasury + burned)
  TOTAL = 'total',             // All fees combined
}

export enum StreamType {
  // Granular fee types (new)
  ASSET_REFERRAL = 'asset_referral',
  ASSET_OMNIPOOL = 'asset_omnipool',
  PROTOCOL_TREASURY = 'protocol_treasury',
  PROTOCOL_BURNED = 'protocol_burned',

  // Aggregated fee types (backward compatibility)
  ASSET = 'asset',
  PROTOCOL = 'protocol',
  BURNED = 'burned',

  // Money market / Hollar types
  LIQUIDATION_PENALTY = 'liquidation_penalty',
  PEPL_LIQUIDATION_PROFIT = 'pepl_liquidation_profit',
  ASSET_RESERVE = 'asset_reserve',
  BORROW_APR = 'borrow_apr',
  HSM_REVENUE = 'hsm_revenue',
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
    description: 'Fee destination filter: "lp" (liquidity providers), "protocol", or "total" (all fees)',
    example: FeeDestination.TOTAL,
  })
  @IsOptional()
  @IsEnum(FeeDestination)
  feeDestination?: FeeDestination;

  @ApiPropertyOptional({
    enum: StreamType,
    description: 'Specific fee stream type. Use with feeDestination to filter granular fee types.',
    example: StreamType.ASSET_REFERRAL,
  })
  @IsOptional()
  @IsEnum(StreamType)
  streamType?: StreamType;
}

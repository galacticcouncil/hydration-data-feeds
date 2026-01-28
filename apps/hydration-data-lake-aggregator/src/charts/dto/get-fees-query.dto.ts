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
  PROTOCOL = 'protocol',
  TOTAL = 'total',
}

export enum StreamType {
  ASSET = 'asset',
  PROTOCOL = 'protocol',
  BURNED = 'burned',
  LIQUIDATION_PENALTY = 'liquidation_penalty',
  PEPL_LIQUIDATION_PROFIT = 'pepl_liquidation_profit',
  ASSET_RESERVE = 'asset_reserve',
  BORROW_APR = 'borrow_apr',
}

export class GetFeesQueryDto {
  @ApiPropertyOptional({
    enum: ProductType,
    default: ProductType.OMNIPOOL,
    description: 'Product type: omnipool (swap fees) or money-market (liquidation fees)'
  })
  @IsOptional()
  @IsEnum(ProductType)
  @Validate(IsValidFeeCombinationConstraint)
  productType?: ProductType = ProductType.OMNIPOOL;

  @ApiPropertyOptional({ enum: BucketSize, default: BucketSize.ONE_HOUR })
  @IsOptional()
  @IsEnum(BucketSize)
  bucketSize?: BucketSize = BucketSize.ONE_HOUR;

  @ApiPropertyOptional({ description: 'ISO 8601 timestamp' })
  @IsOptional()
  @IsISO8601()
  startTime?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 timestamp' })
  @IsOptional()
  @IsISO8601()
  endTime?: string;

  @ApiPropertyOptional({
    enum: FeeDestination,
    description: 'Fee destination: protocol or total'
  })
  @IsOptional()
  @IsEnum(FeeDestination)
  feeDestination?: FeeDestination;

  @ApiPropertyOptional({
    enum: StreamType,
    description: 'Stream type: asset, protocol, burned, or liquidation_penalty'
  })
  @IsOptional()
  @IsEnum(StreamType)
  streamType?: StreamType;
}

import {
  IsEnum,
  IsISO8601,
  IsOptional,
} from 'class-validator';

import { ApiPropertyOptional } from '@nestjs/swagger';

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
}

export enum FeeType {
  // Omnipool fee types
  ASSET = 'asset',
  PROTOCOL = 'protocol',
  BURNED = 'burned',
  // Money Market fee type
  LIQUIDATION_PENALTY = 'liquidation_penalty',
  // Universal
  TOTAL = 'total',
}

export class GetFeesQueryDto {
  @ApiPropertyOptional({
    enum: ProductType,
    default: ProductType.OMNIPOOL,
    description: 'Product type: omnipool (swap fees) or money-market (liquidation fees)'
  })
  @IsOptional()
  @IsEnum(ProductType)
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
    enum: FeeType,
    description: 'Fee type filter. For omnipool: asset/protocol/burned. For money-market: liquidation_penalty. Use "total" for combined fees.'
  })
  @IsOptional()
  @IsEnum(FeeType)
  feeType?: FeeType;
}

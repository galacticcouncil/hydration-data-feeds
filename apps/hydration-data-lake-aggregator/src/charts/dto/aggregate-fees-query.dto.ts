import {
  IsEnum,
  IsISO8601,
  IsOptional,
  Validate,
} from 'class-validator';

import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType, FeeDestination, StreamType } from './get-fees-query.dto';
import { IsValidFeeCombinationConstraint } from '../validators/fee-combination.validator';

export enum AggregationPeriod {
  ONE_MIN = '1min',
  FIVE_MIN = '5min',
  TEN_MIN = '10min',
  THIRTY_MIN = '30min',
  ONE_HOUR = '1hour',
  SIX_HOUR = '6hour',
  TWENTY_FOUR_HOUR = '24hour',
  SEVEN_DAY = '7day',
  THIRTY_DAY = '30day',
  NINETY_DAY = '90day',
  ONE_EIGHTY_DAY = '180day',
  THREE_SIXTY_FIVE_DAY = '365day',
}

export class GetAggregatedFeesQueryDto {
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
    enum: AggregationPeriod,
    description: 'Time period to aggregate (e.g., "1hour" = last 1 hour, "7day" = last 7 days)',
    example: AggregationPeriod.TWENTY_FOUR_HOUR,
  })
  @IsOptional()
  @IsEnum(AggregationPeriod)
  period?: AggregationPeriod;

  @ApiPropertyOptional({
    description: 'Custom start time (ISO 8601 format). Overrides period parameter.',
    example: '2026-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsISO8601()
  startTime?: string;

  @ApiPropertyOptional({
    description: 'Custom end time (ISO 8601 format). Overrides period parameter.',
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
    description: 'Specific fee stream type. Combine with feeDestination for granular filtering.',
    example: StreamType.ASSET,
  })
  @IsOptional()
  @IsEnum(StreamType)
  streamType?: StreamType;
}

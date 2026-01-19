import {
  IsEnum,
  IsISO8601,
  IsOptional,
} from 'class-validator';

import { ApiPropertyOptional } from '@nestjs/swagger';
import { FeeType } from './get-fees-query.dto';

export enum AggregationPeriod {
  ONE_MIN = '1min',
  FIVE_MIN = '5min',
  TEN_MIN = '10min',
  THIRTY_MIN = '30min',
  ONE_HOUR = '1hour',
  SIX_HOUR = '6hour',
  TWENTY_FOUR_HOUR = '24hour',
}

export class GetAggregatedFeesQueryDto {
  @ApiPropertyOptional({
    enum: AggregationPeriod,
    description: 'Aggregation period (e.g., "1hour" = last 1 hour from now)',
    example: '1hour',
  })
  @IsOptional()
  @IsEnum(AggregationPeriod)
  period?: AggregationPeriod;

  @ApiPropertyOptional({
    description: 'Custom start time (ISO 8601 timestamp). Overrides period.',
    example: '2026-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsISO8601()
  startTime?: string;

  @ApiPropertyOptional({
    description: 'Custom end time (ISO 8601 timestamp). Overrides period.',
    example: '2026-01-31T23:59:59Z',
  })
  @IsOptional()
  @IsISO8601()
  endTime?: string;

  @ApiPropertyOptional({
    enum: FeeType,
    description: 'Fee type to aggregate. If omitted, returns all types.',
    example: 'asset',
  })
  @IsOptional()
  @IsEnum(FeeType)
  feeType?: FeeType;
}

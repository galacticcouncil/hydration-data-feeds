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

export enum FeeType {
  ASSET = 'asset',
  PROTOCOL = 'protocol',
  BURNED = 'burned',
  TOTAL = 'total',
}

export class GetFeesQueryDto {
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

  @ApiPropertyOptional({ enum: FeeType })
  @IsOptional()
  @IsEnum(FeeType)
  feeType?: FeeType;
}

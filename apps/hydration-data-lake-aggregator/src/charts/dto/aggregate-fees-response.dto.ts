import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StreamType } from './get-fees-query.dto';
import { AggregationPeriod } from './aggregate-fees-query.dto';

export class AggregateFeeResponseDto {
  @ApiProperty({
    description: 'Aggregated fee value in USD',
    example: 1234.56,
  })
  aggregate: number;

  @ApiProperty({
    description: 'Start time of aggregation period',
    example: '2026-01-19T10:00:00.000Z',
  })
  startTime: string;

  @ApiProperty({
    description: 'End time of aggregation period',
    example: '2026-01-19T11:00:00.000Z',
  })
  endTime: string;

  @ApiPropertyOptional({
    enum: AggregationPeriod,
    description: 'Aggregation period used',
    example: '1hour',
  })
  period?: string;

  @ApiPropertyOptional({
    enum: StreamType,
    description: 'Stream type aggregated',
    example: 'asset',
  })
  feeType?: string;
}

export class AggregateAllFeesResponseDto {
  @ApiProperty({
    description: 'Aggregated fee values by type. For omnipool: total, asset, protocol, burned. For money-market: total, liquidation_penalty',
    example: {
      total: 50000.0,
      asset: 30000.0,
      protocol: 15000.0,
      burned: 5000.0,
    },
  })
  aggregate: Record<string, number>;

  @ApiProperty({
    description: 'Start time of aggregation period',
    example: '2026-01-18T11:00:00.000Z',
  })
  startTime: string;

  @ApiProperty({
    description: 'End time of aggregation period',
    example: '2026-01-19T11:00:00.000Z',
  })
  endTime: string;

  @ApiPropertyOptional({
    enum: AggregationPeriod,
    description: 'Aggregation period used',
    example: '24hour',
  })
  period?: string;
}

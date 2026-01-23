import { ApiProperty } from '@nestjs/swagger';

export class DataPointDto {
  @ApiProperty()
  timestamp: string;

  @ApiProperty()
  value: number;
}

export class SingleFeeTypeResponseDto {
  @ApiProperty({ type: [DataPointDto] })
  data: DataPointDto[];

  @ApiProperty()
  periodAggregate: number;
}

export class AllFeeTypesDataDto {
  @ApiProperty({ type: [DataPointDto] })
  total: DataPointDto[];

  @ApiProperty({ type: [DataPointDto], required: false })
  asset?: DataPointDto[];

  @ApiProperty({ type: [DataPointDto], required: false })
  protocol?: DataPointDto[];

  @ApiProperty({ type: [DataPointDto], required: false })
  burned?: DataPointDto[];

  @ApiProperty({ type: [DataPointDto], required: false })
  liquidation_penalty?: DataPointDto[];
}

export class PeriodAggregateDto {
  @ApiProperty()
  total: number;

  @ApiProperty({ required: false })
  asset?: number;

  @ApiProperty({ required: false })
  protocol?: number;

  @ApiProperty({ required: false })
  burned?: number;

  @ApiProperty({ required: false })
  liquidation_penalty?: number;
}

export class AllFeeTypesResponseDto {
  @ApiProperty({
    description: 'Fee data by type. For omnipool: total, asset, protocol, burned. For money-market: total, liquidation_penalty',
  })
  data: Record<string, DataPointDto[]>;

  @ApiProperty({
    description: 'Period aggregate by type. For omnipool: total, asset, protocol, burned. For money-market: total, liquidation_penalty',
  })
  periodAggregate: Record<string, number>;
}

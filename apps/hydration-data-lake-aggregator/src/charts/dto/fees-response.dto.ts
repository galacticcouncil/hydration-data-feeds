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

  @ApiProperty({ type: [DataPointDto] })
  asset: DataPointDto[];

  @ApiProperty({ type: [DataPointDto] })
  protocol: DataPointDto[];

  @ApiProperty({ type: [DataPointDto] })
  burned: DataPointDto[];
}

export class PeriodAggregateDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  asset: number;

  @ApiProperty()
  protocol: number;

  @ApiProperty()
  burned: number;
}

export class AllFeeTypesResponseDto {
  @ApiProperty({ type: AllFeeTypesDataDto })
  data: AllFeeTypesDataDto;

  @ApiProperty({ type: PeriodAggregateDto })
  periodAggregate: PeriodAggregateDto;
}

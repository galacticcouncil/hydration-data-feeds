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

  @ApiProperty({ type: [DataPointDto], required: false })
  pepl_liquidation_profit?: DataPointDto[];

  @ApiProperty({ type: [DataPointDto], required: false })
  asset_reserve?: DataPointDto[];

  @ApiProperty({ type: [DataPointDto], required: false })
  borrow_apr?: DataPointDto[];
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

  @ApiProperty({ required: false })
  pepl_liquidation_profit?: number;

  @ApiProperty({ required: false })
  asset_reserve?: number;

  @ApiProperty({ required: false })
  borrow_apr?: number;
}

export class AllFeeTypesResponseDto {
  @ApiProperty({
    description: 'Fee data by type. For omnipool: total, asset, protocol, burned. For money-market: total, liquidation_penalty, pepl_liquidation_profit, asset_reserve, borrow_apr',
  })
  data: Record<string, DataPointDto[]>;

  @ApiProperty({
    description: 'Period aggregate by type. For omnipool: total, asset, protocol, burned. For money-market: total, liquidation_penalty, pepl_liquidation_profit, asset_reserve, borrow_apr',
  })
  periodAggregate: Record<string, number>;
}

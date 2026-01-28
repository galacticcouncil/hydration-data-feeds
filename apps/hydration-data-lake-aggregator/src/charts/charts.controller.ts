import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ChartsService } from './charts.service';
import { GetFeesQueryDto } from './dto/get-fees-query.dto';
import {
  SingleFeeTypeResponseDto,
  AllFeeTypesResponseDto,
} from './dto/fees-response.dto';
import { GetAggregatedFeesQueryDto } from './dto/aggregate-fees-query.dto';
import {
  AggregateFeeResponseDto,
  AggregateAllFeesResponseDto,
} from './dto/aggregate-fees-response.dto';

@Controller('api/v1/charts')
@ApiTags('Charts')
export class ChartsController {
  constructor(private readonly chartsService: ChartsService) {}

  @Get('fees')
  @ApiOperation({
    summary: 'Get fee chart data',
    description:
      'Retrieves aggregated fee data from continuous aggregates. ' +
      'Valid combinations: ' +
      'omnipool+protocol+asset, omnipool+protocol+protocol, omnipool+protocol+burned, omnipool+total, ' +
      'money-market+protocol+liquidation_penalty, money-market+protocol+pepl_liquidation_profit, ' +
      'money-market+protocol+asset_reserve, money-market+total (returns 4 separate values: liquidation_penalty, pepl_liquidation_profit, asset_reserve, total), ' +
      'hollar+protocol+borrow_apr, hollar+protocol+hsm_revenue',
  })
  @ApiResponse({
    status: 200,
    description: 'Fee chart data',
    type: SingleFeeTypeResponseDto,
  })
  async getFees(
    @Query() query: GetFeesQueryDto,
  ): Promise<SingleFeeTypeResponseDto | AllFeeTypesResponseDto> {
    return this.chartsService.getFees(query);
  }

  @Get('aggregate')
  @ApiOperation({
    summary: 'Get aggregated fee values',
    description:
      'Returns only aggregated fee totals without chart data points. ' +
      'If feeType is specified, returns single aggregate value. ' +
      'If feeType is omitted, returns breakdown of all fee types. ' +
      'Use "period" parameter for quick time windows (e.g., period=1hour for last hour), ' +
      'or use startTime/endTime for custom date ranges. ' +
      'Valid combinations: same as /fees endpoint',
  })
  @ApiResponse({
    status: 200,
    description: 'Aggregated fee values',
    type: AggregateFeeResponseDto,
  })
  async getAggregatedFees(
    @Query() query: GetAggregatedFeesQueryDto,
  ): Promise<AggregateFeeResponseDto | AggregateAllFeesResponseDto> {
    return this.chartsService.getAggregatedFees(query);
  }
}

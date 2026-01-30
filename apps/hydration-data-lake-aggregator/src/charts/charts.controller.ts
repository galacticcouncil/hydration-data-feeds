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

@Controller('api/v1/fees')
@ApiTags('Fees')
export class ChartsController {
  constructor(private readonly chartsService: ChartsService) {}

  @Get('charts')
  @ApiOperation({
    summary: 'Get fee chart time-series data',
    description:
      'Retrieves time-series fee data with timestamps and values for charting.\n\n' +
      '**OMNIPOOL Filter Combinations:**\n' +
      '• `lp+asset_referral` - Referral fees (granular)\n' +
      '• `lp+asset_omnipool` - Omnipool fees (granular)\n' +
      '• `lp+asset` - All LP fees (aggregated)\n' +
      '• `protocol+protocol_treasury` - Treasury fees (granular)\n' +
      '• `protocol+protocol_burned` - Burned fees (granular)\n' +
      '• `protocol+protocol` - All protocol fees (aggregated)\n' +
      '• `total` - All fees with nested granular breakdown\n\n' +
      '**MONEY MARKET Filter Combinations:**\n' +
      '• `protocol+liquidation_penalty` - Liquidation penalty fees\n' +
      '• `protocol+pepl_liquidation_profit` - PEPL liquidation profit\n' +
      '• `protocol+asset_reserve` - Asset reserve fees\n' +
      '• `total` - All money market fees\n\n' +
      '**HOLLAR Filter Combinations:**\n' +
      '• `protocol+borrow_apr` - Borrow APR fees\n' +
      '• `protocol+hsm_revenue` - HSM revenue\n' +
      '• `total` - All Hollar fees',
  })
  @ApiResponse({
    status: 200,
    description: 'Time-series fee data with timestamps and values',
    type: AllFeeTypesResponseDto,
  })
  async getFees(
    @Query() query: GetFeesQueryDto,
  ): Promise<SingleFeeTypeResponseDto | AllFeeTypesResponseDto> {
    return this.chartsService.getFees(query);
  }

  @Get('aggregate')
  @ApiOperation({
    summary: 'Get aggregated fee totals',
    description:
      'Returns aggregated fee totals without time-series data (single numeric values).\n\n' +
      '**Time Ranges:**\n' +
      '• Use `period` for quick windows (e.g., "1hour", "24hour", "7day")\n' +
      '• Use `startTime` + `endTime` for custom date ranges (overrides period)\n\n' +
      '**OMNIPOOL Aggregations:**\n' +
      '• `total` (no streamType) → Returns: `{ total, asset, protocol, granular: {...} }`\n' +
      '• `total+asset` → Returns: `{ total, asset_referral, asset_omnipool }`\n' +
      '• `total+protocol` → Returns: `{ total, protocol_treasury, protocol_burned }`\n' +
      '• `lp+asset_referral` → Single value\n' +
      '• `lp+asset_omnipool` → Single value\n' +
      '• `lp+asset` → Single value (aggregated)\n' +
      '• `protocol+protocol_treasury` → Single value\n' +
      '• `protocol+protocol_burned` → Single value\n' +
      '• `protocol+protocol` → Single value (aggregated)\n\n' +
      '**MONEY MARKET Aggregations:**\n' +
      '• `total` → Returns all fee types breakdown\n' +
      '• `protocol+liquidation_penalty` → Single value\n' +
      '• `protocol+pepl_liquidation_profit` → Single value\n' +
      '• `protocol+asset_reserve` → Single value\n\n' +
      '**HOLLAR Aggregations:**\n' +
      '• `total` → Returns all fee types breakdown\n' +
      '• `protocol+borrow_apr` → Single value\n' +
      '• `protocol+hsm_revenue` → Single value',
  })
  @ApiResponse({
    status: 200,
    description: 'Aggregated fee totals (numeric values only)',
    type: AggregateAllFeesResponseDto,
  })
  async getAggregatedFees(
    @Query() query: GetAggregatedFeesQueryDto,
  ): Promise<AggregateFeeResponseDto | AggregateAllFeesResponseDto> {
    return this.chartsService.getAggregatedFees(query);
  }
}

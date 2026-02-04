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
      'Filter order: `productType → streamType → feeDestination`\n\n' +
      '**OMNIPOOL:**\n' +
      '• `asset + lp` - Referral pallet fees\n' +
      '• `asset + protocol` - Omnipool pallet fees\n' +
      '• `asset + total` - All asset fees (referral + omnipool)\n' +
      '• `protocol + protocol` - Treasury fees\n' +
      '• `protocol + burned` - Burned fees\n' +
      '• `protocol + total` - All protocol fees (treasury + burned)\n' +
      '• `total` - All omnipool fees with full breakdown\n\n' +
      '**MONEY MARKET:**\n' +
      '• `liquidation_penalty + protocol` - Liquidation penalty fees\n' +
      '• `pepl_liquidation_profit + protocol` - PEPL liquidation profit\n' +
      '• `asset_reserve + protocol` - Asset reserve fees\n' +
      '• `total` - All money market fees\n\n' +
      '**HOLLAR:**\n' +
      '• `borrow_apr + protocol` - Borrow APR fees\n' +
      '• `hsm_revenue + protocol` - HSM revenue\n' +
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
      'Filter order: `productType → streamType → feeDestination`\n\n' +
      '**OMNIPOOL:**\n' +
      '• `total` → Returns: `{ total, asset, protocol, granular: {...} }`\n' +
      '• `asset + total` → Returns: `{ total, asset_referral, asset_omnipool }`\n' +
      '• `protocol + total` → Returns: `{ total, protocol_treasury, protocol_burned }`\n' +
      '• `asset + lp` → Single value (referral pallet)\n' +
      '• `asset + protocol` → Single value (omnipool pallet)\n' +
      '• `protocol + protocol` → Single value (treasury)\n' +
      '• `protocol + burned` → Single value (burned)\n\n' +
      '**MONEY MARKET:**\n' +
      '• `total` → Returns all fee types breakdown\n' +
      '• `liquidation_penalty + protocol` → Single value\n' +
      '• `pepl_liquidation_profit + protocol` → Single value\n' +
      '• `asset_reserve + protocol` → Single value\n\n' +
      '**HOLLAR:**\n' +
      '• `total` → Returns all fee types breakdown\n' +
      '• `borrow_apr + protocol` → Single value\n' +
      '• `hsm_revenue + protocol` → Single value',
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

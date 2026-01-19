import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ChartsService } from './charts.service';
import { GetFeesQueryDto } from './dto/get-fees-query.dto';
import {
  SingleFeeTypeResponseDto,
  AllFeeTypesResponseDto,
} from './dto/fees-response.dto';

@Controller('api/v1/charts')
@ApiTags('Charts')
export class ChartsController {
  constructor(private readonly chartsService: ChartsService) {}

  @Get('fees')
  @ApiOperation({
    summary: 'Get fee chart data',
    description:
      'Retrieves aggregated fee data from continuous aggregates. ' +
      'If feeType is specified, returns single fee type data. ' +
      'If feeType is omitted, returns all fee types in breakdown format.',
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
}

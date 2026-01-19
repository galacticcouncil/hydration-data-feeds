import { DataSource } from 'typeorm';

import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import {
  AllFeeTypesResponseDto,
  SingleFeeTypeResponseDto,
} from './dto/fees-response.dto';
import {
  BucketSize,
  FeeType,
  GetFeesQueryDto,
} from './dto/get-fees-query.dto';

@Injectable()
export class ChartsService {
  private readonly logger = new Logger(ChartsService.name);

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async getFees(
    query: GetFeesQueryDto,
  ): Promise<SingleFeeTypeResponseDto | AllFeeTypesResponseDto> {
    this.logger.log(`Incoming request with query: ${JSON.stringify(query)}`);

    const { bucket, startTime, endTime, feeType } =
      this.buildQueryParams(query);

    this.logger.log(
      `Processed params - bucket=${bucket}, startTime=${startTime}, endTime=${endTime}, feeType=${feeType || 'all'}`,
    );

    if (feeType) {
      return this.getSingleFeeType(bucket, startTime, endTime, feeType);
    } else {
      return this.getAllFeeTypes(bucket, startTime, endTime);
    }
  }

  private buildQueryParams(query: GetFeesQueryDto) {
    const bucket = query.bucketSize || BucketSize.ONE_HOUR;
    const endTime = query.endTime || new Date().toISOString();
    const startTime =
      query.startTime ||
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    this.logger.debug(
      `Built query params - bucket: ${bucket}, startTime: ${startTime}, endTime: ${endTime}`,
    );

    return { bucket, startTime, endTime, feeType: query.feeType };
  }

  private async getSingleFeeType(
    bucket: BucketSize,
    startTime: string,
    endTime: string,
    feeType: FeeType,
  ): Promise<SingleFeeTypeResponseDto> {
    const tableName = this.getTableName(bucket);
    const valueColumn = this.getValueColumn(feeType);

    const sql = `
      SELECT
        bucket as timestamp,
        ${valueColumn} as value
      FROM ${tableName}
      WHERE bucket >= $1 AND bucket <= $2
      ORDER BY bucket ASC
    `;

    this.logger.log(
      `Executing SQL for single fee type:\nTable: ${tableName}\nQuery: ${sql}\nParams: [$1=${startTime}, $2=${endTime}]`,
    );

    const rawData = await this.dataSource.query(sql, [startTime, endTime]);

    this.logger.log(
      `Raw data from DB: ${rawData.length} rows. First row: ${JSON.stringify(rawData[0])}`,
    );

    const data = rawData.map((row) => ({
      timestamp: row.timestamp,
      value: parseFloat(row.value) || 0,
    }));

    const periodAggregate = data.reduce((sum, point) => sum + point.value, 0);

    this.logger.log(
      `Processed ${data.length} data points for ${feeType} with aggregate ${periodAggregate}`,
    );

    return { data, periodAggregate };
  }

  private async getAllFeeTypes(
    bucket: BucketSize,
    startTime: string,
    endTime: string,
  ): Promise<AllFeeTypesResponseDto> {
    const tableName = this.getTableName(bucket);

    const sql = `
      SELECT
        bucket as timestamp,
        total_fee_usd as total,
        (fees_by_type->>'asset')::numeric as asset,
        (fees_by_type->>'protocol')::numeric as protocol,
        (fees_by_type->>'burned')::numeric as burned
      FROM ${tableName}
      WHERE bucket >= $1 AND bucket <= $2
      ORDER BY bucket ASC
    `;

    this.logger.log(
      `Executing SQL for all fee types:\nTable: ${tableName}\nQuery: ${sql}\nParams: [$1=${startTime}, $2=${endTime}]`,
    );

    const rawData = await this.dataSource.query(sql, [startTime, endTime]);

    this.logger.log(
      `Raw data from DB: ${rawData.length} rows. First row: ${JSON.stringify(rawData[0])}`,
    );

    const data = {
      total: [],
      asset: [],
      protocol: [],
      burned: [],
    };

    const aggregates = { total: 0, asset: 0, protocol: 0, burned: 0 };

    rawData.forEach((row) => {
      ['total', 'asset', 'protocol', 'burned'].forEach((type) => {
        const value = parseFloat(row[type]) || 0;
        data[type].push({ timestamp: row.timestamp, value });
        aggregates[type] += value;
      });
    });

    this.logger.log(
      `Processed ${rawData.length} data points. Aggregates: ${JSON.stringify(aggregates)}`,
    );

    return { data, periodAggregate: aggregates };
  }

  private getTableName(bucket: BucketSize): string {
    // Convert bucket enum to table name (e.g., '1hour' -> 'fees_1hour')
    return `fees_${bucket}`;
  }

  private getValueColumn(feeType: FeeType): string {
    if (feeType === FeeType.TOTAL) {
      return 'total_fee_usd';
    }
    return `(fees_by_type->>'${feeType}')::numeric`;
  }
}

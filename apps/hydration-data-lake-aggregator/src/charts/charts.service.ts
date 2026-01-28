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
  FeeDestination,
  StreamType,
  ProductType,
  GetFeesQueryDto,
} from './dto/get-fees-query.dto';
import {
  AggregationPeriod,
  GetAggregatedFeesQueryDto,
} from './dto/aggregate-fees-query.dto';
import {
  AggregateFeeResponseDto,
  AggregateAllFeesResponseDto,
} from './dto/aggregate-fees-response.dto';

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

    const { productType, bucket, startTime, endTime, feeDestination, streamType } =
      this.buildQueryParams(query);

    this.logger.log(
      `Processed params - productType=${productType}, bucket=${bucket}, startTime=${startTime}, endTime=${endTime}, feeDestination=${feeDestination}, streamType=${streamType}`,
    );

    // Route based on feeDestination
    if (feeDestination === FeeDestination.TOTAL) {
      return this.getAllFeeTypes(productType, bucket, startTime, endTime);
    } else {
      // feeDestination === 'protocol', streamType will be present (validated by decorator)
      return this.getSingleStreamType(productType, bucket, startTime, endTime, streamType!);
    }
  }

  private buildQueryParams(query: GetFeesQueryDto) {
    const productType = query.productType || ProductType.OMNIPOOL;
    const bucket = query.bucketSize || BucketSize.ONE_HOUR;
    const endTime = query.endTime || new Date().toISOString();
    const startTime =
      query.startTime ||
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    this.logger.debug(
      `Built query params - productType: ${productType}, bucket: ${bucket}, startTime: ${startTime}, endTime: ${endTime}`,
    );

    return {
      productType,
      bucket,
      startTime,
      endTime,
      feeDestination: query.feeDestination,
      streamType: query.streamType
    };
  }

  private async getSingleStreamType(
    productType: ProductType,
    bucket: BucketSize,
    startTime: string,
    endTime: string,
    streamType: StreamType,
  ): Promise<SingleFeeTypeResponseDto> {
    const tableName = this.getTableName(productType, bucket, streamType);
    const valueColumn = this.getValueColumn(productType, streamType);

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
      `Processed ${data.length} data points for ${streamType} with aggregate ${periodAggregate}`,
    );

    return { data, periodAggregate };
  }

  private async getAllFeeTypes(
    productType: ProductType,
    bucket: BucketSize,
    startTime: string,
    endTime: string,
  ): Promise<AllFeeTypesResponseDto> {
    const tableName = this.getTableName(productType, bucket);

    // Build SQL based on product type
    let sql: string;
    if (productType === ProductType.OMNIPOOL) {
      sql = `
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
    } else {
      // MONEY_MARKET
      sql = `
        SELECT
          bucket as timestamp,
          total_liquidation_fee_usd as total,
          (fees_by_type->>'LIQUIDATION_PENALTY')::numeric as liquidation_penalty,
          (fees_by_type->>'PEPL_LIQUIDATION_PROFIT')::numeric as pepl_liquidation_profit,
          (fees_by_type->>'ASSET_RESERVE')::numeric as asset_reserve,
          (fees_by_type->>'BORROW_APR')::numeric as borrow_apr
        FROM ${tableName}
        WHERE bucket >= $1 AND bucket <= $2
        ORDER BY bucket ASC
      `;
    }

    this.logger.log(
      `Executing SQL for all fee types:\nTable: ${tableName}\nQuery: ${sql}\nParams: [$1=${startTime}, $2=${endTime}]`,
    );

    const rawData = await this.dataSource.query(sql, [startTime, endTime]);

    this.logger.log(
      `Raw data from DB: ${rawData.length} rows. First row: ${JSON.stringify(rawData[0])}`,
    );

    let data: Record<string, Array<{ timestamp: string; value: number }>>;
    let aggregates: Record<string, number>;

    if (productType === ProductType.OMNIPOOL) {
      data = {
        total: [],
        asset: [],
        protocol: [],
        burned: [],
      };
      aggregates = { total: 0, asset: 0, protocol: 0, burned: 0 };

      rawData.forEach((row) => {
        ['total', 'asset', 'protocol', 'burned'].forEach((type) => {
          const value = parseFloat(row[type]) || 0;
          data[type].push({ timestamp: row.timestamp, value });
          aggregates[type] += value;
        });
      });
    } else {
      // MONEY_MARKET
      data = {
        total: [],
        liquidation_penalty: [],
        pepl_liquidation_profit: [],
        asset_reserve: [],
        borrow_apr: [],
      };
      aggregates = { total: 0, liquidation_penalty: 0, pepl_liquidation_profit: 0, asset_reserve: 0, borrow_apr: 0 };

      rawData.forEach((row) => {
        ['total', 'liquidation_penalty', 'pepl_liquidation_profit', 'asset_reserve', 'borrow_apr'].forEach((type) => {
          const value = parseFloat(row[type]) || 0;
          data[type].push({ timestamp: row.timestamp, value });
          aggregates[type] += value;
        });
      });
    }

    this.logger.log(
      `Processed ${rawData.length} data points. Aggregates: ${JSON.stringify(aggregates)}`,
    );

    return { data, periodAggregate: aggregates };
  }

  private getTableName(productType: ProductType, bucket: BucketSize, streamType?: StreamType): string {
    // Convert product type and bucket to table name
    if (productType === ProductType.OMNIPOOL) {
      return `fees_${bucket}`;
    } else if (productType === ProductType.MONEY_MARKET) {
      return `liquidation_fees_${bucket}`;
    } else if (productType === ProductType.HOLLAR) {
      // HSM revenue has its own table
      if (streamType === StreamType.HSM_REVENUE) {
        return `hsm_revenue_${bucket}`;
      }
      // Borrow APR uses liquidation_fees tables
      return `liquidation_fees_${bucket}`;
    }
    // Fallback to liquidation_fees for any other product type
    return `liquidation_fees_${bucket}`;
  }

  private getValueColumn(productType: ProductType, streamType: StreamType): string {
    // Map stream type to JSONB key (money market uses uppercase keys)
    if (productType === ProductType.MONEY_MARKET) {
      if (streamType === StreamType.LIQUIDATION_PENALTY) {
        return `(fees_by_type->>'LIQUIDATION_PENALTY')::numeric`;
      } else if (streamType === StreamType.PEPL_LIQUIDATION_PROFIT) {
        return `(fees_by_type->>'PEPL_LIQUIDATION_PROFIT')::numeric`;
      } else if (streamType === StreamType.ASSET_RESERVE) {
        return `(fees_by_type->>'ASSET_RESERVE')::numeric`;
      }
    }

    // Hollar stream types
    if (productType === ProductType.HOLLAR) {
      if (streamType === StreamType.BORROW_APR) {
        return `(fees_by_type->>'BORROW_APR')::numeric`;
      } else if (streamType === StreamType.HSM_REVENUE) {
        // HSM revenue has direct column, not JSONB
        return `hsm_revenue`;
      }
    }

    // For omnipool, DB keys match stream types (asset, protocol, burned)
    return `(fees_by_type->>'${streamType}')::numeric`;
  }

  /**
   * Get aggregated fee values without chart data
   */
  async getAggregatedFees(
    query: GetAggregatedFeesQueryDto,
  ): Promise<AggregateFeeResponseDto | AggregateAllFeesResponseDto> {
    this.logger.log(
      `Incoming aggregated fees request: ${JSON.stringify(query)}`,
    );

    const { productType = ProductType.OMNIPOOL, period, feeDestination, streamType } = query;

    // Calculate time range
    let startTime: Date;
    let endTime: Date;

    if (query.startTime && query.endTime) {
      // Custom range takes precedence
      startTime = new Date(query.startTime);
      endTime = new Date(query.endTime);
      this.logger.debug(
        `Using custom time range: ${startTime.toISOString()} to ${endTime.toISOString()}`,
      );
    } else if (period) {
      // Calculate from period
      endTime = new Date();
      startTime = this.calculateStartTimeFromPeriod(endTime, period);
      this.logger.debug(
        `Using period ${period}: ${startTime.toISOString()} to ${endTime.toISOString()}`,
      );
    } else {
      // Default: last 24 hours
      endTime = new Date();
      startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
      this.logger.debug(
        `Using default 24h range: ${startTime.toISOString()} to ${endTime.toISOString()}`,
      );
    }

    // Route based on feeDestination
    if (feeDestination === FeeDestination.TOTAL) {
      return this.getAggregatedAllFeeTypes(productType, startTime, endTime, period);
    } else {
      // feeDestination === 'protocol', streamType will be present (validated by decorator)
      return this.getAggregatedSingleStreamType(
        productType,
        startTime,
        endTime,
        streamType!,
        period,
      );
    }
  }

  /**
   * Calculate start time from aggregation period
   */
  private calculateStartTimeFromPeriod(
    endTime: Date,
    period: AggregationPeriod,
  ): Date {
    const periodMs = {
      [AggregationPeriod.ONE_MIN]: 60 * 1000,
      [AggregationPeriod.FIVE_MIN]: 5 * 60 * 1000,
      [AggregationPeriod.TEN_MIN]: 10 * 60 * 1000,
      [AggregationPeriod.THIRTY_MIN]: 30 * 60 * 1000,
      [AggregationPeriod.ONE_HOUR]: 60 * 60 * 1000,
      [AggregationPeriod.SIX_HOUR]: 6 * 60 * 60 * 1000,
      [AggregationPeriod.TWENTY_FOUR_HOUR]: 24 * 60 * 60 * 1000,
      [AggregationPeriod.SEVEN_DAY]: 7 * 24 * 60 * 60 * 1000,
      [AggregationPeriod.THIRTY_DAY]: 30 * 24 * 60 * 60 * 1000,
      [AggregationPeriod.NINETY_DAY]: 90 * 24 * 60 * 60 * 1000,
      [AggregationPeriod.ONE_EIGHTY_DAY]: 180 * 24 * 60 * 60 * 1000,
      [AggregationPeriod.THREE_SIXTY_FIVE_DAY]: 365 * 24 * 60 * 60 * 1000,
    };

    return new Date(endTime.getTime() - periodMs[period]);
  }

  /**
   * Get aggregated value for single stream type
   */
  private async getAggregatedSingleStreamType(
    productType: ProductType,
    startTime: Date,
    endTime: Date,
    streamType: StreamType,
    period?: AggregationPeriod,
  ): Promise<AggregateFeeResponseDto> {
    // Use any continuous aggregate table - sum is same regardless of bucket size
    const tableName = this.getTableName(productType, BucketSize.ONE_HOUR, streamType);
    const valueColumn = this.getValueColumn(productType, streamType);

    const sql = `
      SELECT
        SUM(${valueColumn}) as aggregate
      FROM ${tableName}
      WHERE bucket >= $1 AND bucket <= $2
    `;

    this.logger.log(
      `Executing aggregated query for ${streamType}:\nTable: ${tableName}\nParams: [${startTime.toISOString()}, ${endTime.toISOString()}]`,
    );

    const result = await this.dataSource.query(sql, [startTime, endTime]);

    const aggregate = parseFloat(result[0]?.aggregate || '0');

    this.logger.log(`Aggregated ${streamType} fees: ${aggregate}`);

    return {
      aggregate,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      period,
      feeType: streamType,
    };
  }

  /**
   * Get aggregated values for all fee types
   */
  private async getAggregatedAllFeeTypes(
    productType: ProductType,
    startTime: Date,
    endTime: Date,
    period?: AggregationPeriod,
  ): Promise<AggregateAllFeesResponseDto> {
    // Use any continuous aggregate table - sum is same regardless of bucket size
    const tableName = this.getTableName(productType, BucketSize.ONE_HOUR);

    let sql: string;
    if (productType === ProductType.OMNIPOOL) {
      sql = `
        SELECT
          SUM(total_fee_usd) as total,
          SUM((fees_by_type->>'asset')::numeric) as asset,
          SUM((fees_by_type->>'protocol')::numeric) as protocol,
          SUM((fees_by_type->>'burned')::numeric) as burned
        FROM ${tableName}
        WHERE bucket >= $1 AND bucket <= $2
      `;
    } else {
      // MONEY_MARKET
      sql = `
        SELECT
          SUM(total_liquidation_fee_usd) as total,
          SUM((fees_by_type->>'LIQUIDATION_PENALTY')::numeric) as liquidation_penalty,
          SUM((fees_by_type->>'PEPL_LIQUIDATION_PROFIT')::numeric) as pepl_liquidation_profit,
          SUM((fees_by_type->>'ASSET_RESERVE')::numeric) as asset_reserve,
          SUM((fees_by_type->>'BORROW_APR')::numeric) as borrow_apr
        FROM ${tableName}
        WHERE bucket >= $1 AND bucket <= $2
      `;
    }

    this.logger.log(
      `Executing aggregated query for all fee types:\nTable: ${tableName}\nParams: [${startTime.toISOString()}, ${endTime.toISOString()}]`,
    );

    const result = await this.dataSource.query(sql, [startTime, endTime]);

    let aggregate: Record<string, number>;
    if (productType === ProductType.OMNIPOOL) {
      aggregate = {
        total: parseFloat(result[0]?.total || '0'),
        asset: parseFloat(result[0]?.asset || '0'),
        protocol: parseFloat(result[0]?.protocol || '0'),
        burned: parseFloat(result[0]?.burned || '0'),
      };
    } else {
      // MONEY_MARKET
      aggregate = {
        total: parseFloat(result[0]?.total || '0'),
        liquidation_penalty: parseFloat(result[0]?.liquidation_penalty || '0'),
        pepl_liquidation_profit: parseFloat(result[0]?.pepl_liquidation_profit || '0'),
        asset_reserve: parseFloat(result[0]?.asset_reserve || '0'),
        borrow_apr: parseFloat(result[0]?.borrow_apr || '0'),
      };
    }

    this.logger.log(`Aggregated all fees: ${JSON.stringify(aggregate)}`);

    return {
      aggregate,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      period,
    };
  }
}

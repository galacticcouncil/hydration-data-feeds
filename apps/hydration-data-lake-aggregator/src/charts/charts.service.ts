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
  HsmAggregationType,
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

    const { productType, bucket, startTime, endTime, feeDestination, streamType, hsmAggregationType } =
      this.buildQueryParams(query);

    this.logger.log(
      `Processed params - productType=${productType}, bucket=${bucket}, startTime=${startTime}, endTime=${endTime}, feeDestination=${feeDestination}, streamType=${streamType}, hsmAggregationType=${hsmAggregationType}`,
    );

    const decoratedData = query.decoratedData ?? true;

    // Route based on streamType
    if (streamType === StreamType.TOTAL) {
      return this.getAllFeeTypes(productType, bucket, startTime, endTime, decoratedData, hsmAggregationType);
    } else {
      // streamType is a specific fee stream; feeDestination selects the sub-bucket
      return this.getSingleStreamType(productType, bucket, startTime, endTime, streamType!, feeDestination!, decoratedData, hsmAggregationType);
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
      streamType: query.streamType,
      hsmAggregationType: query.hsmAggregationType || HsmAggregationType.DELTA,
    };
  }

  private async getSingleStreamType(
    productType: ProductType,
    bucket: BucketSize,
    startTime: string,
    endTime: string,
    streamType: StreamType,
    feeDestination: FeeDestination,
    decoratedData: boolean,
    hsmAggregationType: HsmAggregationType = HsmAggregationType.CUMULATIVE,
  ): Promise<SingleFeeTypeResponseDto> {
    const tableName = this.getTableName(productType, bucket, streamType, hsmAggregationType);
    const valueColumn = this.getValueColumn(productType, streamType, feeDestination, hsmAggregationType);

    const selectValue = decoratedData ? `GREATEST(${valueColumn}, 0)` : valueColumn;
    const sql = `
      SELECT
        bucket as timestamp,
        ${selectValue} as value
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

    // HSM revenue is a trend metric - return average of all data points
    const periodAggregate = streamType === StreamType.HSM_REVENUE
      ? data.reduce((sum, point) => sum + point.value, 0) / (data.length || 1)
      : data.reduce((sum, point) => sum + point.value, 0);

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
    decoratedData: boolean,
    hsmAggregationType: HsmAggregationType = HsmAggregationType.CUMULATIVE,
  ): Promise<AllFeeTypesResponseDto> {
    const tableName = this.getTableName(productType, bucket, undefined, hsmAggregationType);

    const g = (col: string) => decoratedData ? `GREATEST(${col}, 0)` : col;

    // Build SQL based on product type
    let sql: string;
    if (productType === ProductType.OMNIPOOL) {
      sql = `
        SELECT
          bucket as timestamp,
          ${g('total_fee_usd')} as total,
          -- Granular fee types
          ${g(`(fees_by_type->>'asset_referral')::numeric`)} as asset_lp,
          ${g(`(fees_by_type->>'asset_omnipool')::numeric`)} as asset_protocol,
          ${g(`(fees_by_type->>'protocol_treasury')::numeric`)} as protocol_protocol,
          ${g(`(fees_by_type->>'protocol_burned')::numeric`)} as protocol_burned,
          -- Aggregated fee types
          ${g(`(fees_by_type->>'asset')::numeric`)} as asset,
          ${g(`(fees_by_type->>'protocol')::numeric`)} as protocol
        FROM ${tableName}
        WHERE bucket >= $1 AND bucket <= $2
        ORDER BY bucket ASC
      `;
    } else if (productType === ProductType.MONEY_MARKET) {
      sql = `
        SELECT
          bucket as timestamp,
          ${g('total_liquidation_fee_usd')} as total,
          ${g(`(fees_by_type->>'LIQUIDATION_PENALTY')::numeric`)} as liquidation_penalty,
          ${g(`(fees_by_type->>'PEPL_LIQUIDATION_PROFIT')::numeric`)} as pepl_liquidation_profit,
          ${g(`(fees_by_type->>'ASSET_RESERVE')::numeric`)} as asset_reserve
        FROM ${tableName}
        WHERE bucket >= $1 AND bucket <= $2
        ORDER BY bucket ASC
      `;
    } else {
      // HOLLAR
      // Note: No 'total' field - borrow_apr (SUM) and hsm_revenue (AVG) cannot be meaningfully combined
      sql = `
        SELECT
          bucket as timestamp,
          ${g(`(fees_by_type->>'BORROW_APR')::numeric`)} as borrow_apr,
          ${g(`(fees_by_type->>'HSM_REVENUE')::numeric`)} as hsm_revenue
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

    let data: Record<string, any>;
    let aggregates: Record<string, any>;

    if (productType === ProductType.OMNIPOOL) {
      data = {
        total: [],
        asset: [],
        protocol: [],
        granular: {
          asset_lp: [],
          asset_protocol: [],
          protocol_protocol: [],
          protocol_burned: [],
        },
      };
      aggregates = {
        total: 0,
        asset: 0,
        protocol: 0,
        granular: {
          asset_lp: 0,
          asset_protocol: 0,
          protocol_protocol: 0,
          protocol_burned: 0,
        },
      };

      rawData.forEach((row) => {
        const timestamp = row.timestamp;

        // Top-level aggregated values
        ['total', 'asset', 'protocol'].forEach((type) => {
          const value = parseFloat(row[type]) || 0;
          data[type].push({ timestamp, value });
          aggregates[type] += value;
        });

        // Granular breakdown
        ['asset_lp', 'asset_protocol', 'protocol_protocol', 'protocol_burned'].forEach((type) => {
          const value = parseFloat(row[type]) || 0;
          data.granular[type].push({ timestamp, value });
          aggregates.granular[type] += value;
        });
      });
    } else if (productType === ProductType.MONEY_MARKET) {
      data = {
        total: [],
        liquidation_penalty: [],
        pepl_liquidation_profit: [],
        asset_reserve: [],
      };
      aggregates = { total: 0, liquidation_penalty: 0, pepl_liquidation_profit: 0, asset_reserve: 0 };

      rawData.forEach((row) => {
        ['total', 'liquidation_penalty', 'pepl_liquidation_profit', 'asset_reserve'].forEach((type) => {
          const value = parseFloat(row[type]) || 0;
          data[type].push({ timestamp: row.timestamp, value });
          aggregates[type] += value;
        });
      });
    } else {
      // HOLLAR - no 'total' field (borrow_apr and hsm_revenue use different aggregation methods)
      data = {
        borrow_apr: [],
        hsm_revenue: [],
      };
      aggregates = { borrow_apr: 0, hsm_revenue: 0 };

      rawData.forEach((row) => {
        // Borrow APR - flow metric (SUM)
        const borrowAprValue = parseFloat(row.borrow_apr) || 0;
        data.borrow_apr.push({ timestamp: row.timestamp, value: borrowAprValue });
        aggregates.borrow_apr += borrowAprValue;

        // HSM revenue - trend metric (AVG)
        const hsmRevenueValue = parseFloat(row.hsm_revenue) || 0;
        data.hsm_revenue.push({ timestamp: row.timestamp, value: hsmRevenueValue });
        aggregates.hsm_revenue += hsmRevenueValue;
      });

      // Calculate average for HSM revenue (trend metric)
      if (rawData.length > 0) {
        aggregates.hsm_revenue = aggregates.hsm_revenue / rawData.length;
      }
    }

    this.logger.log(
      `Processed ${rawData.length} data points. Aggregates: ${JSON.stringify(aggregates)}`,
    );

    return { data, periodAggregate: aggregates };
  }

  private getTableName(productType: ProductType, bucket: BucketSize, streamType?: StreamType, hsmAggregationType: HsmAggregationType = HsmAggregationType.CUMULATIVE): string {
    // Convert product type and bucket to table name
    if (productType === ProductType.OMNIPOOL) {
      return `fees_${bucket}`;
    } else if (productType === ProductType.MONEY_MARKET) {
      return `liquidation_fees_${bucket}`;
    } else if (productType === ProductType.HOLLAR) {
      // HSM revenue has its own table
      if (streamType === StreamType.HSM_REVENUE) {
        // Use delta table if aggregationType is DELTA
        if (hsmAggregationType === HsmAggregationType.DELTA) {
          return `hsm_revenue_delta_${bucket}`;
        }
        return `hsm_revenue_${bucket}`;
      }
      // Borrow APR uses liquidation_fees tables
      return `liquidation_fees_${bucket}`;
    }
    // Fallback to liquidation_fees for any other product type
    return `liquidation_fees_${bucket}`;
  }

  private getValueColumn(productType: ProductType, streamType: StreamType, feeDestination: FeeDestination, hsmAggregationType: HsmAggregationType = HsmAggregationType.CUMULATIVE): string {
    // Omnipool: feeDestination selects the sub-bucket within the stream
    if (productType === ProductType.OMNIPOOL) {
      if (streamType === StreamType.ASSET) {
        if (feeDestination === FeeDestination.LIQUIDITY_PROVIDER) return `(fees_by_type->>'asset_referral')::numeric`;
        if (feeDestination === FeeDestination.PROTOCOL) return `(fees_by_type->>'asset_omnipool')::numeric`;
        return `(fees_by_type->>'asset')::numeric`; // total
      }
      if (streamType === StreamType.PROTOCOL) {
        if (feeDestination === FeeDestination.PROTOCOL) return `(fees_by_type->>'protocol_treasury')::numeric`;
        if (feeDestination === FeeDestination.BURNED) return `(fees_by_type->>'protocol_burned')::numeric`;
        return `(fees_by_type->>'protocol')::numeric`; // total
      }
    }

    // Money market (uppercase JSONB keys)
    if (productType === ProductType.MONEY_MARKET) {
      if (streamType === StreamType.LIQUIDATION_PENALTY) return `(fees_by_type->>'LIQUIDATION_PENALTY')::numeric`;
      if (streamType === StreamType.PEPL_LIQUIDATION_PROFIT) return `(fees_by_type->>'PEPL_LIQUIDATION_PROFIT')::numeric`;
      if (streamType === StreamType.ASSET_RESERVE) return `(fees_by_type->>'ASSET_RESERVE')::numeric`;
    }

    // Hollar
    if (productType === ProductType.HOLLAR) {
      if (streamType === StreamType.BORROW_APR) return `(fees_by_type->>'BORROW_APR')::numeric`;
      if (streamType === StreamType.HSM_REVENUE) {
        // Use delta column if aggregationType is DELTA
        return hsmAggregationType === HsmAggregationType.DELTA ? `hsm_revenue_delta` : `hsm_revenue`;
      }
    }

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

    const { productType = ProductType.OMNIPOOL, period, feeDestination, streamType, decoratedData = true, hsmAggregationType = HsmAggregationType.DELTA } = query;

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

    // Route based on streamType and feeDestination
    if (streamType === StreamType.TOTAL) {
      // product + total → Returns full breakdown for the product
      return this.getAggregatedAllFeeTypes(productType, startTime, endTime, period, decoratedData, hsmAggregationType);
    } else if ((streamType === StreamType.ASSET || streamType === StreamType.PROTOCOL) && feeDestination === FeeDestination.TOTAL) {
      // omnipool + asset/protocol + total → Returns granular breakdown for that stream type
      return this.getAggregatedGranularByStreamType(
        productType,
        startTime,
        endTime,
        streamType,
        period,
        decoratedData,
        hsmAggregationType,
      );
    } else {
      // Single value query (e.g., omnipool + asset + lp)
      return this.getAggregatedSingleStreamType(
        productType,
        startTime,
        endTime,
        streamType!,
        feeDestination!,
        period,
        decoratedData,
        hsmAggregationType,
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
   * Select optimal bucket size based on query period length
   * Only used for HSM revenue aggregation to balance performance and spike smoothing
   */
  private selectBucketForPeriod(startTime: Date, endTime: Date): BucketSize {
    const periodMs = endTime.getTime() - startTime.getTime();

    const ONE_HOUR = 60 * 60 * 1000;
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

    if (periodMs < ONE_HOUR) {
      return BucketSize.ONE_MIN;
    } else if (periodMs < SIX_HOURS) {
      return BucketSize.FIVE_MIN;
    } else if (periodMs < THREE_DAYS) {
      return BucketSize.ONE_HOUR;
    } else if (periodMs < THIRTY_DAYS) {
      return BucketSize.SIX_HOUR;
    } else {
      return BucketSize.TWENTY_FOUR_HOUR;
    }
  }

  /**
   * Get aggregated value for single stream type
   */
  private async getAggregatedSingleStreamType(
    productType: ProductType,
    startTime: Date,
    endTime: Date,
    streamType: StreamType,
    feeDestination: FeeDestination,
    period?: AggregationPeriod,
    decoratedData: boolean = true,
    hsmAggregationType: HsmAggregationType = HsmAggregationType.DELTA,
  ): Promise<AggregateFeeResponseDto> {
    let sql: string;
    let tableName: string;
    const valueColumn = this.getValueColumn(productType, streamType, feeDestination, hsmAggregationType);
    const aggExpr = decoratedData ? `GREATEST(${valueColumn}, 0)` : valueColumn;

    // HSM revenue is a trend metric - return average over the period
    if (streamType === StreamType.HSM_REVENUE) {
      // Dynamically select bucket size based on period length
      const bucketSize = this.selectBucketForPeriod(startTime, endTime);
      tableName = this.getTableName(productType, bucketSize, StreamType.HSM_REVENUE, hsmAggregationType);

      sql = `
        SELECT AVG(${aggExpr}) as aggregate
        FROM ${tableName}
        WHERE bucket >= $1 AND bucket <= $2
      `;
    } else {
      // Flow metrics - sum over the period
      // Use any continuous aggregate table - sum is same regardless of bucket size
      tableName = this.getTableName(productType, BucketSize.ONE_HOUR, streamType, hsmAggregationType);

      sql = `
        SELECT SUM(${aggExpr}) as aggregate
        FROM ${tableName}
        WHERE bucket >= $1 AND bucket <= $2
      `;
    }

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
   * Get aggregated granular breakdown by stream type
   * Examples:
   * - omnipool + asset + total → { total, asset_lp, asset_protocol }
   * - omnipool + protocol + total → { total, protocol_protocol, protocol_burned }
   */
  private async getAggregatedGranularByStreamType(
    productType: ProductType,
    startTime: Date,
    endTime: Date,
    streamType: StreamType,
    period?: AggregationPeriod,
    decoratedData: boolean = true,
    hsmAggregationType: HsmAggregationType = HsmAggregationType.DELTA,
  ): Promise<AggregateAllFeesResponseDto> {
    const tableName = this.getTableName(productType, BucketSize.ONE_HOUR);

    const g = (col: string) => decoratedData ? `GREATEST(${col}, 0)` : col;

    let sql: string;
    let aggregate: Record<string, number>;

    if (productType === ProductType.OMNIPOOL) {
      if (streamType === StreamType.ASSET) {
        // omnipool + asset + total → Returns: total, asset_lp, asset_protocol
        sql = `
          SELECT
            SUM(${g(`(fees_by_type->>'asset')::numeric`)}) as total,
            SUM(${g(`(fees_by_type->>'asset_referral')::numeric`)}) as asset_lp,
            SUM(${g(`(fees_by_type->>'asset_omnipool')::numeric`)}) as asset_protocol
          FROM ${tableName}
          WHERE bucket >= $1 AND bucket <= $2
        `;

        const result = await this.dataSource.query(sql, [startTime, endTime]);

        aggregate = {
          total: parseFloat(result[0]?.total || '0'),
          asset_lp: parseFloat(result[0]?.asset_lp || '0'),
          asset_protocol: parseFloat(result[0]?.asset_protocol || '0'),
        };
      } else if (streamType === StreamType.PROTOCOL) {
        // omnipool + protocol + total → Returns: total, protocol_protocol, protocol_burned
        sql = `
          SELECT
            SUM(${g(`(fees_by_type->>'protocol')::numeric`)}) as total,
            SUM(${g(`(fees_by_type->>'protocol_treasury')::numeric`)}) as protocol_protocol,
            SUM(${g(`(fees_by_type->>'protocol_burned')::numeric`)}) as protocol_burned
          FROM ${tableName}
          WHERE bucket >= $1 AND bucket <= $2
        `;

        const result = await this.dataSource.query(sql, [startTime, endTime]);

        aggregate = {
          total: parseFloat(result[0]?.total || '0'),
          protocol_protocol: parseFloat(result[0]?.protocol_protocol || '0'),
          protocol_burned: parseFloat(result[0]?.protocol_burned || '0'),
        };
      } else {
        return this.getAggregatedAllFeeTypes(productType, startTime, endTime, period, decoratedData, hsmAggregationType);
      }
    } else {
      return this.getAggregatedAllFeeTypes(productType, startTime, endTime, period, decoratedData, hsmAggregationType);
    }

    this.logger.log(
      `Aggregated granular fees for ${streamType}: ${JSON.stringify(aggregate)}`,
    );

    return {
      aggregate,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      period,
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
    decoratedData: boolean = true,
    hsmAggregationType: HsmAggregationType = HsmAggregationType.DELTA,
  ): Promise<AggregateAllFeesResponseDto> {
    // Use any continuous aggregate table - sum is same regardless of bucket size
    const tableName = this.getTableName(productType, BucketSize.ONE_HOUR);

    const g = (col: string) => decoratedData ? `GREATEST(${col}, 0)` : col;

    let sql: string;
    if (productType === ProductType.OMNIPOOL) {
      sql = `
        SELECT
          SUM(${g('total_fee_usd')}) as total,
          -- Granular fee types
          SUM(${g(`(fees_by_type->>'asset_referral')::numeric`)}) as asset_lp,
          SUM(${g(`(fees_by_type->>'asset_omnipool')::numeric`)}) as asset_protocol,
          SUM(${g(`(fees_by_type->>'protocol_treasury')::numeric`)}) as protocol_protocol,
          SUM(${g(`(fees_by_type->>'protocol_burned')::numeric`)}) as protocol_burned,
          -- Aggregated fee types
          SUM(${g(`(fees_by_type->>'asset')::numeric`)}) as asset,
          SUM(${g(`(fees_by_type->>'protocol')::numeric`)}) as protocol
        FROM ${tableName}
        WHERE bucket >= $1 AND bucket <= $2
      `;
    } else if (productType === ProductType.MONEY_MARKET) {
      sql = `
        SELECT
          SUM(${g('total_liquidation_fee_usd')}) as total,
          SUM(${g(`(fees_by_type->>'LIQUIDATION_PENALTY')::numeric`)}) as liquidation_penalty,
          SUM(${g(`(fees_by_type->>'PEPL_LIQUIDATION_PROFIT')::numeric`)}) as pepl_liquidation_profit,
          SUM(${g(`(fees_by_type->>'ASSET_RESERVE')::numeric`)}) as asset_reserve
        FROM ${tableName}
        WHERE bucket >= $1 AND bucket <= $2
      `;
    } else {
      // HOLLAR
      // Note: No 'total' field - borrow_apr (SUM flow metric) and hsm_revenue (AVG trend metric)
      // cannot be meaningfully combined
      // Dynamically select bucket size for HSM revenue based on period
      const hsmBucketSize = this.selectBucketForPeriod(startTime, endTime);
      const hsmRevenueTable = this.getTableName(
        productType,
        hsmBucketSize,
        StreamType.HSM_REVENUE,
        hsmAggregationType,
      );
      const hsmColumnName = hsmAggregationType === HsmAggregationType.DELTA ? 'hsm_revenue_delta' : 'hsm_revenue';
      sql = `
        SELECT
          SUM(${g(`(fees_by_type->>'BORROW_APR')::numeric`)}) as borrow_apr,
          (SELECT AVG(${g(hsmColumnName)}) FROM ${hsmRevenueTable} WHERE bucket >= $1 AND bucket <= $2) as hsm_revenue
        FROM ${tableName}
        WHERE bucket >= $1 AND bucket <= $2
      `;
    }

    this.logger.log(
      `Executing aggregated query for all fee types:\nTable: ${tableName}\nParams: [${startTime.toISOString()}, ${endTime.toISOString()}]`,
    );

    const result = await this.dataSource.query(sql, [startTime, endTime]);

    let aggregate: Record<string, any>;
    if (productType === ProductType.OMNIPOOL) {
      aggregate = {
        total: parseFloat(result[0]?.total || '0'),
        asset: parseFloat(result[0]?.asset || '0'),
        protocol: parseFloat(result[0]?.protocol || '0'),
        granular: {
          asset_lp: parseFloat(result[0]?.asset_lp || '0'),
          asset_protocol: parseFloat(result[0]?.asset_protocol || '0'),
          protocol_protocol: parseFloat(result[0]?.protocol_protocol || '0'),
          protocol_burned: parseFloat(result[0]?.protocol_burned || '0'),
        },
      };
    } else if (productType === ProductType.MONEY_MARKET) {
      aggregate = {
        total: parseFloat(result[0]?.total || '0'),
        liquidation_penalty: parseFloat(result[0]?.liquidation_penalty || '0'),
        pepl_liquidation_profit: parseFloat(result[0]?.pepl_liquidation_profit || '0'),
        asset_reserve: parseFloat(result[0]?.asset_reserve || '0'),
      };
    } else {
      // HOLLAR - no 'total' field (different aggregation methods for borrow_apr vs hsm_revenue)
      aggregate = {
        borrow_apr: parseFloat(result[0]?.borrow_apr || '0'),
        hsm_revenue: parseFloat(result[0]?.hsm_revenue || '0'),
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

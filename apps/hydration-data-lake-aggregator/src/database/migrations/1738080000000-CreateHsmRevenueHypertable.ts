import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to create HSM revenue hypertable and continuous aggregates
 *
 * Creates:
 * - hsm_revenue_raw table (hypertable)
 * - 7 continuous aggregates (1min, 5min, 10min, 30min, 1hour, 6hour, 24hour)
 *
 * HSM Revenue Calculation:
 * - Fetched from aaveFacilitatorHistoricalData and accountTotalBalanceHistoricalData
 * - Revenue = bucketLevel (normalized to 18 decimals) - totalTransferableNorm
 * - No JSONB structure - direct hsm_revenue column
 * - No USD conversion needed (assetId 10 is USDT)
 */
export class CreateHsmRevenueHypertable1738080000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================
    // 1. Create hsm_revenue_raw table
    // ========================================
    await queryRunner.query(`
      CREATE TABLE hsm_revenue_raw (
        time TIMESTAMPTZ NOT NULL,
        block_height INTEGER NOT NULL,
        bucket_level NUMERIC(78, 18) NOT NULL,
        total_transferable_norm NUMERIC(78, 18) NOT NULL,
        hsm_revenue NUMERIC(78, 18) NOT NULL,
        ingested_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (time, block_height)
      );
    `);

    // Convert to hypertable
    await queryRunner.query(
      `SELECT create_hypertable('hsm_revenue_raw', 'time');`,
    );

    // Create index on block_height for efficient querying
    await queryRunner.query(`
      CREATE INDEX idx_hsm_revenue_raw_block_height ON hsm_revenue_raw (block_height);
    `);

    // ========================================
    // 2. Create continuous aggregates for HSM revenue
    // ========================================
    const hsmRevenueIntervals = [
      {
        name: 'hsm_revenue_1min',
        interval: '1 minute',
        refreshInterval: '1 minute',
        lag: '1 minute',
        startOffset: '10 minutes', // Keep last 10 minutes refreshable for late-arriving data
      },
      {
        name: 'hsm_revenue_5min',
        interval: '5 minutes',
        refreshInterval: '5 minutes',
        lag: '5 minutes',
        startOffset: '1 hour', // Keep last hour refreshable
      },
      {
        name: 'hsm_revenue_10min',
        interval: '10 minutes',
        refreshInterval: '10 minutes',
        lag: '10 minutes',
        startOffset: '2 hours', // Keep last 2 hours refreshable
      },
      {
        name: 'hsm_revenue_30min',
        interval: '30 minutes',
        refreshInterval: '30 minutes',
        lag: '30 minutes',
        startOffset: '6 hours', // Keep last 6 hours refreshable
      },
      {
        name: 'hsm_revenue_1hour',
        interval: '1 hour',
        refreshInterval: '1 hour',
        lag: '1 hour',
        startOffset: '1 day', // Keep last day refreshable
      },
      {
        name: 'hsm_revenue_6hour',
        interval: '6 hours',
        refreshInterval: '6 hours',
        lag: '6 hours',
        startOffset: '3 days', // Keep last 3 days refreshable
      },
      {
        name: 'hsm_revenue_24hour',
        interval: '1 day',
        refreshInterval: '1 day',
        lag: '1 day',
        startOffset: '7 days', // Keep last week refreshable
      },
    ];

    for (const config of hsmRevenueIntervals) {
      // Create continuous aggregate - simple SUM aggregation on hsm_revenue
      await queryRunner.query(`
        CREATE MATERIALIZED VIEW ${config.name}
        WITH (timescaledb.continuous) AS
        SELECT
          time_bucket('${config.interval}', h.time) AS bucket,
          SUM(h.hsm_revenue) AS hsm_revenue,
          COUNT(*) AS event_count
        FROM hsm_revenue_raw h
        GROUP BY bucket
        WITH NO DATA;
      `);

      // Add refresh policy with appropriate start_offset for each interval
      await queryRunner.query(`
        SELECT add_continuous_aggregate_policy('${config.name}',
          start_offset => INTERVAL '${config.startOffset}',
          end_offset => INTERVAL '${config.lag}',
          schedule_interval => INTERVAL '${config.refreshInterval}');
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop continuous aggregates (in reverse order)
    const hsmRevenueIntervals = [
      'hsm_revenue_24hour',
      'hsm_revenue_6hour',
      'hsm_revenue_1hour',
      'hsm_revenue_30min',
      'hsm_revenue_10min',
      'hsm_revenue_5min',
      'hsm_revenue_1min',
    ];

    for (const viewName of hsmRevenueIntervals) {
      await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS ${viewName};`);
    }

    // Drop hypertable (CASCADE will remove associated policies)
    await queryRunner.query(`DROP TABLE IF EXISTS hsm_revenue_raw CASCADE;`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to create Borrow APR hypertable and continuous aggregates
 *
 * Creates:
 * - borrow_apr_raw table (hypertable) - stores normalized transfer amounts and spot prices
 * - 7 continuous aggregates (1min, 5min, 10min, 30min, 1hour, 6hour, 24hour)
 *
 * Borrow APR Data Source:
 * - Fetched from `transfers` table filtered by toId and assetId
 * - Amount is normalized using asset decimals
 * - USD value computed at query time: amount * (fee_spot_prices->>'assetId')::numeric
 * - Continuous aggregates use SUM(amount * price) as the `borrow_apr` column
 */
export class CreateBorrowAprHypertable1738300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================
    // 1. Create borrow_apr_raw table
    // ========================================
    await queryRunner.query(`
      CREATE TABLE borrow_apr_raw (
        time TIMESTAMPTZ NOT NULL,
        block_height INTEGER NOT NULL,
        event_id VARCHAR(255) NOT NULL,
        amount NUMERIC(78, 18) NOT NULL,
        asset_id VARCHAR(255) NOT NULL,
        fee_spot_prices JSONB NOT NULL DEFAULT '{}',
        ingested_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (time, block_height, event_id)
      );
    `);

    // Convert to hypertable
    await queryRunner.query(
      `SELECT create_hypertable('borrow_apr_raw', 'time');`,
    );

    // Create index on block_height for efficient querying
    await queryRunner.query(`
      CREATE INDEX idx_borrow_apr_raw_block_height ON borrow_apr_raw (block_height);
    `);

    // ========================================
    // 2. Create continuous aggregates for Borrow APR
    // ========================================
    const borrowAprIntervals = [
      {
        name: 'borrow_apr_1min',
        interval: '1 minute',
        refreshInterval: '1 minute',
        lag: '1 minute',
        startOffset: '10 minutes',
      },
      {
        name: 'borrow_apr_5min',
        interval: '5 minutes',
        refreshInterval: '5 minutes',
        lag: '5 minutes',
        startOffset: '1 hour',
      },
      {
        name: 'borrow_apr_10min',
        interval: '10 minutes',
        refreshInterval: '10 minutes',
        lag: '10 minutes',
        startOffset: '2 hours',
      },
      {
        name: 'borrow_apr_30min',
        interval: '30 minutes',
        refreshInterval: '30 minutes',
        lag: '30 minutes',
        startOffset: '6 hours',
      },
      {
        name: 'borrow_apr_1hour',
        interval: '1 hour',
        refreshInterval: '1 hour',
        lag: '1 hour',
        startOffset: '1 day',
      },
      {
        name: 'borrow_apr_6hour',
        interval: '6 hours',
        refreshInterval: '6 hours',
        lag: '6 hours',
        startOffset: '3 days',
      },
      {
        name: 'borrow_apr_24hour',
        interval: '1 day',
        refreshInterval: '1 day',
        lag: '1 day',
        startOffset: '7 days',
      },
    ];

    for (const config of borrowAprIntervals) {
      await queryRunner.query(`
        CREATE MATERIALIZED VIEW ${config.name}
        WITH (timescaledb.continuous) AS
        SELECT
          time_bucket('${config.interval}', b.time) AS bucket,
          SUM(b.amount * COALESCE((b.fee_spot_prices->>(b.asset_id))::numeric, 0)) AS borrow_apr,
          COUNT(*) AS event_count
        FROM borrow_apr_raw b
        GROUP BY bucket
        WITH NO DATA;
      `);

      await queryRunner.query(`
        SELECT add_continuous_aggregate_policy('${config.name}',
          start_offset => INTERVAL '${config.startOffset}',
          end_offset => INTERVAL '${config.lag}',
          schedule_interval => INTERVAL '${config.refreshInterval}');
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const borrowAprViews = [
      'borrow_apr_24hour',
      'borrow_apr_6hour',
      'borrow_apr_1hour',
      'borrow_apr_30min',
      'borrow_apr_10min',
      'borrow_apr_5min',
      'borrow_apr_1min',
    ];

    for (const viewName of borrowAprViews) {
      await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS ${viewName};`);
    }

    await queryRunner.query(`DROP TABLE IF EXISTS borrow_apr_raw CASCADE;`);
  }
}

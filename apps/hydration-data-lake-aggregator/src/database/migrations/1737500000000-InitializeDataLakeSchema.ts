import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

/**
 * Consolidated migration for hydration data lake
 * Creates all tables with embedded price data
 *
 * Key features:
 * - swaps_raw table with fee_spot_prices column
 * - money_market_raw table with fee_spot_prices column
 * - Continuous aggregates using embedded prices directly
 *
 * This design embeds prices directly in fee tables for simplicity and reliability
 */
export class InitializeDataLakeSchema1737500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================
    // 1. Enable TimescaleDB Extension
    // ========================================
    await queryRunner.query(
      `CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`,
    );

    // ========================================
    // 2. Create swaps_raw table
    // ========================================
    await queryRunner.query(`
      CREATE TABLE swaps_raw (
        time TIMESTAMPTZ NOT NULL,
        swap_id VARCHAR(255) NOT NULL,
        block_height INTEGER NOT NULL,
        filler_id VARCHAR(255) NOT NULL,
        filler_type VARCHAR(50) NOT NULL,
        fee_asset_ids TEXT[] NOT NULL,
        fee_amounts_raw JSONB NOT NULL,
        fee_by_recipient JSONB NOT NULL,
        fee_spot_prices JSONB NOT NULL DEFAULT '{}',
        ingested_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (time, swap_id)
      );
    `);

    // Convert to hypertable
    await queryRunner.query(`SELECT create_hypertable('swaps_raw', 'time');`);

    // Create indexes for swaps_raw
    await queryRunner.query(`
      CREATE INDEX idx_swaps_raw_block_height ON swaps_raw (block_height);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_swaps_raw_filler_id ON swaps_raw (filler_id);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_swaps_raw_fee_asset_ids ON swaps_raw USING GIN(fee_asset_ids);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_swaps_raw_fee_by_recipient ON swaps_raw USING GIN(fee_by_recipient);
    `);

    // Add retention policy to swaps_raw (keep 90 days)
    await queryRunner.query(`
      SELECT add_retention_policy('swaps_raw', INTERVAL '90 days');
    `);

    // ========================================
    // 3. Create money_market_raw table
    // ========================================
    await queryRunner.query(`
      CREATE TABLE money_market_raw (
        time TIMESTAMPTZ NOT NULL,
        liquidation_event_id VARCHAR(255) NOT NULL,
        block_height INTEGER NOT NULL,
        liquidation_call_id VARCHAR(255),
        fee_asset_ids TEXT[] NOT NULL,
        fee_amounts_raw JSONB NOT NULL,
        fee_by_transfer JSONB NOT NULL,
        fee_spot_prices JSONB NOT NULL DEFAULT '{}',
        ingested_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (time, liquidation_event_id)
      );
    `);

    // Convert to hypertable
    await queryRunner.query(
      `SELECT create_hypertable('money_market_raw', 'time');`,
    );

    // Create indexes for money_market_raw
    await queryRunner.query(`
      CREATE INDEX idx_money_market_raw_block_height ON money_market_raw (block_height);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_money_market_raw_liquidation_call_id ON money_market_raw (liquidation_call_id);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_money_market_raw_fee_asset_ids ON money_market_raw USING GIN(fee_asset_ids);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_money_market_raw_fee_by_transfer ON money_market_raw USING GIN(fee_by_transfer);
    `);

    // Add retention policy to money_market_raw (keep 90 days)
    await queryRunner.query(`
      SELECT add_retention_policy('money_market_raw', INTERVAL '90 days');
    `);

    // ========================================
    // 4. Create continuous aggregates for swap fees
    // ========================================
    const swapIntervals = [
      {
        name: 'fees_1min',
        interval: '1 minute',
        refreshInterval: '1 minute',
        lag: '1 minute',
        startOffset: '10 minutes', // Keep last 10 minutes refreshable for late-arriving data
      },
      {
        name: 'fees_5min',
        interval: '5 minutes',
        refreshInterval: '5 minutes',
        lag: '5 minutes',
        startOffset: '1 hour', // Keep last hour refreshable
      },
      {
        name: 'fees_10min',
        interval: '10 minutes',
        refreshInterval: '10 minutes',
        lag: '10 minutes',
        startOffset: '2 hours', // Keep last 2 hours refreshable
      },
      {
        name: 'fees_30min',
        interval: '30 minutes',
        refreshInterval: '30 minutes',
        lag: '30 minutes',
        startOffset: '6 hours', // Keep last 6 hours refreshable
      },
      {
        name: 'fees_1hour',
        interval: '1 hour',
        refreshInterval: '1 hour',
        lag: '1 hour',
        startOffset: '1 day', // Keep last day refreshable
      },
      {
        name: 'fees_6hour',
        interval: '6 hours',
        refreshInterval: '6 hours',
        lag: '6 hours',
        startOffset: '3 days', // Keep last 3 days refreshable
      },
      {
        name: 'fees_24hour',
        interval: '1 day',
        refreshInterval: '1 day',
        lag: '1 day',
        startOffset: '7 days', // Keep last week refreshable
      },
    ];

    for (const config of swapIntervals) {
      // Create continuous aggregate using embedded prices
      await queryRunner.query(`
        CREATE MATERIALIZED VIEW ${config.name}
        WITH (timescaledb.continuous) AS
        SELECT
          time_bucket('${config.interval}', s.time) AS bucket,

          -- Total fees in USD (using embedded prices)
          SUM(
            (fee_rec->>'amount')::numeric *
            COALESCE((s.fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0)
          ) AS total_fee_usd,

          -- Fees by type
          jsonb_build_object(
            'asset',
            COALESCE(SUM(
              CASE
                WHEN (fee_rec->>'feeType') = 'asset'
                THEN (fee_rec->>'amount')::numeric *
                     COALESCE((s.fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0)
                ELSE 0
              END
            ), 0),
            'protocol',
            COALESCE(SUM(
              CASE
                WHEN (fee_rec->>'feeType') = 'protocol'
                THEN (fee_rec->>'amount')::numeric *
                     COALESCE((s.fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0)
                ELSE 0
              END
            ), 0),
            'burned',
            COALESCE(SUM(
              CASE
                WHEN (fee_rec->>'feeType') = 'burned'
                THEN (fee_rec->>'amount')::numeric *
                     COALESCE((s.fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0)
                ELSE 0
              END
            ), 0)
          ) AS fees_by_type,

          -- Swap count
          COUNT(DISTINCT s.swap_id) AS swap_count

        FROM swaps_raw s
        CROSS JOIN LATERAL jsonb_array_elements(s.fee_by_recipient) AS fee_rec
        WHERE jsonb_typeof(s.fee_spot_prices) = 'object'
          AND s.fee_spot_prices != '{}'::jsonb

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

    // ========================================
    // 6. Create continuous aggregates for liquidation fees
    // ========================================
    const liquidationIntervals = [
      {
        name: 'liquidation_fees_1min',
        interval: '1 minute',
        refreshInterval: '1 minute',
        lag: '1 minute',
        startOffset: '10 minutes', // Keep last 10 minutes refreshable for late-arriving data
      },
      {
        name: 'liquidation_fees_5min',
        interval: '5 minutes',
        refreshInterval: '5 minutes',
        lag: '5 minutes',
        startOffset: '1 hour', // Keep last hour refreshable
      },
      {
        name: 'liquidation_fees_10min',
        interval: '10 minutes',
        refreshInterval: '10 minutes',
        lag: '10 minutes',
        startOffset: '2 hours', // Keep last 2 hours refreshable
      },
      {
        name: 'liquidation_fees_30min',
        interval: '30 minutes',
        refreshInterval: '30 minutes',
        lag: '30 minutes',
        startOffset: '6 hours', // Keep last 6 hours refreshable
      },
      {
        name: 'liquidation_fees_1hour',
        interval: '1 hour',
        refreshInterval: '1 hour',
        lag: '1 hour',
        startOffset: '1 day', // Keep last day refreshable
      },
      {
        name: 'liquidation_fees_6hour',
        interval: '6 hours',
        refreshInterval: '6 hours',
        lag: '6 hours',
        startOffset: '3 days', // Keep last 3 days refreshable
      },
      {
        name: 'liquidation_fees_24hour',
        interval: '1 day',
        refreshInterval: '1 day',
        lag: '1 day',
        startOffset: '7 days', // Keep last week refreshable
      },
    ];

    for (const config of liquidationIntervals) {
      // Create continuous aggregate using embedded prices
      await queryRunner.query(`
        CREATE MATERIALIZED VIEW ${config.name}
        WITH (timescaledb.continuous) AS
        SELECT
          time_bucket('${config.interval}', m.time) AS bucket,

          -- Total liquidation fees in USD (using embedded prices, respecting countInTotal flag)
          SUM(
            CASE
              WHEN COALESCE((fee_transfer->>'countInTotal')::boolean, true) = true
              THEN (fee_transfer->>'amount')::numeric *
                   COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0)
              ELSE 0
            END
          ) AS total_liquidation_fee_usd,

          -- Fees by type
          jsonb_build_object(
            'LIQUIDATION_PENALTY',
            COALESCE(SUM(
              CASE
                WHEN (fee_transfer->>'feeType') = 'LIQUIDATION_PENALTY'
                THEN (fee_transfer->>'amount')::numeric *
                     COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0)
                ELSE 0
              END
            ), 0),
            'PEPL_LIQUIDATION_PROFIT',
            COALESCE(SUM(
              CASE
                WHEN (fee_transfer->>'feeType') = 'PEPL_LIQUIDATION_PROFIT'
                THEN (fee_transfer->>'amount')::numeric *
                     COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0)
                ELSE 0
              END
            ), 0),
            'ASSET_RESERVE',
            COALESCE(SUM(
              CASE
                WHEN (fee_transfer->>'feeType') = 'ASSET_RESERVE'
                THEN (fee_transfer->>'amount')::numeric *
                     COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0)
                ELSE 0
              END
            ), 0),
            'BORROW_APR',
            COALESCE(SUM(
              CASE
                WHEN (fee_transfer->>'feeType') = 'BORROW_APR'
                THEN (fee_transfer->>'amount')::numeric *
                     COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0)
                ELSE 0
              END
            ), 0),
            'OTHER',
            COALESCE(SUM(
              CASE
                WHEN (fee_transfer->>'feeType') = 'OTHER'
                THEN (fee_transfer->>'amount')::numeric *
                     COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0)
                ELSE 0
              END
            ), 0)
          ) AS fees_by_type,

          -- Liquidation count
          COUNT(DISTINCT m.liquidation_event_id) AS liquidation_count,

          -- Transfer count
          COUNT(fee_transfer) AS transfer_count

        FROM money_market_raw m
        CROSS JOIN LATERAL jsonb_array_elements(m.fee_by_transfer) AS fee_transfer
        WHERE jsonb_typeof(m.fee_spot_prices) = 'object'
          AND m.fee_spot_prices != '{}'::jsonb

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

    // ========================================
    // 7. Note about continuous aggregate refresh
    // ========================================
    // Continuous aggregates are created with WITH NO DATA and require an initial
    // refresh to populate historical data. However, refresh_continuous_aggregate()
    // cannot run inside a transaction block.
    //
    // Options for initial data population:
    // 1. The automatic refresh policies configured above will populate data over time
    // 2. Manually run refresh after migration completes (outside transaction):
    //    CALL refresh_continuous_aggregate('fees_1min', NULL, NULL);
    //    CALL refresh_continuous_aggregate('fees_5min', NULL, NULL);
    //    ... etc for all aggregates
    //
    // The refresh policies will ensure data stays up-to-date going forward.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop continuous aggregates (swap fees)
    const swapViews = [
      'fees_1min',
      'fees_5min',
      'fees_10min',
      'fees_30min',
      'fees_1hour',
      'fees_6hour',
      'fees_24hour',
    ];

    for (const view of swapViews) {
      await queryRunner.query(
        `DROP MATERIALIZED VIEW IF EXISTS ${view} CASCADE;`,
      );
    }

    // Drop continuous aggregates (liquidation fees)
    const liquidationViews = [
      'liquidation_fees_1min',
      'liquidation_fees_5min',
      'liquidation_fees_10min',
      'liquidation_fees_30min',
      'liquidation_fees_1hour',
      'liquidation_fees_6hour',
      'liquidation_fees_24hour',
    ];

    for (const view of liquidationViews) {
      await queryRunner.query(
        `DROP MATERIALIZED VIEW IF EXISTS ${view} CASCADE;`,
      );
    }

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS money_market_raw CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS swaps_raw CASCADE;`);
  }
}

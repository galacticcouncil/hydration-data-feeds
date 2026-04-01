import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Consolidated schema migration — replaces all prior migrations.
 *
 * Creates the complete final-state schema in one pass:
 *   - swaps_raw, money_market_raw, hsm_revenue_raw, borrow_apr_raw hypertables
 *   - All continuous aggregates (1min → 30day) with correct final definitions
 *   - HSM delta hypertables, functions, and background job (fixed versions)
 *
 * transaction = false required: TimescaleDB DDL (CREATE MATERIALIZED VIEW,
 * refresh_continuous_aggregate, add_job) cannot run inside a transaction block.
 */
export class InitializeDataLakeSchema1743292800000 implements MigrationInterface {
  public transaction = false;

  // ── Shared CAGG configs ──────────────────────────────────────────────────

  private readonly swapCaggConfigs = [
    { name: 'fees_1min',    interval: '1 minute',  startOffset: '2 hours',   lag: '1 minute',  refreshInterval: '1 minute'  },
    { name: 'fees_5min',    interval: '5 minutes', startOffset: '12 hours',  lag: '5 minutes', refreshInterval: '5 minutes' },
    { name: 'fees_10min',   interval: '10 minutes',startOffset: '1 day',     lag: '10 minutes',refreshInterval: '10 minutes'},
    { name: 'fees_30min',   interval: '30 minutes',startOffset: '3 days',    lag: '30 minutes',refreshInterval: '30 minutes'},
    { name: 'fees_1hour',   interval: '1 hour',    startOffset: '7 days',    lag: '1 hour',    refreshInterval: '1 hour'    },
    { name: 'fees_6hour',   interval: '6 hours',   startOffset: '30 days',   lag: '6 hours',   refreshInterval: '6 hours'   },
    // 24hour: schedule_interval=1hour, end_offset=1hour to avoid day-skipping
    { name: 'fees_24hour',  interval: '24 hours',  startOffset: '7 days',    lag: '1 hour',    refreshInterval: '1 hour'    },
    { name: 'fees_7day',    interval: '7 days',    startOffset: '180 days',  lag: '1 hour',    refreshInterval: '1 day'     },
    { name: 'fees_30day',   interval: '30 days',   startOffset: '365 days',  lag: '1 hour',    refreshInterval: '1 day'     },
  ];

  private readonly liquidationCaggConfigs = [
    { name: 'liquidation_fees_1min',    interval: '1 minute',  startOffset: '10 minutes', lag: '1 minute',  refreshInterval: '1 minute'  },
    { name: 'liquidation_fees_5min',    interval: '5 minutes', startOffset: '1 hour',     lag: '5 minutes', refreshInterval: '5 minutes' },
    { name: 'liquidation_fees_10min',   interval: '10 minutes',startOffset: '2 hours',    lag: '10 minutes',refreshInterval: '10 minutes'},
    { name: 'liquidation_fees_30min',   interval: '30 minutes',startOffset: '6 hours',    lag: '30 minutes',refreshInterval: '30 minutes'},
    { name: 'liquidation_fees_1hour',   interval: '1 hour',    startOffset: '1 day',      lag: '1 hour',    refreshInterval: '1 hour'    },
    { name: 'liquidation_fees_6hour',   interval: '6 hours',   startOffset: '3 days',     lag: '6 hours',   refreshInterval: '6 hours'   },
    // 24hour: schedule_interval=1hour, end_offset=1hour to avoid day-skipping
    { name: 'liquidation_fees_24hour',  interval: '1 day',     startOffset: '7 days',     lag: '1 hour',    refreshInterval: '1 hour'    },
    { name: 'liquidation_fees_7day',    interval: '7 days',    startOffset: '180 days',   lag: '1 hour',    refreshInterval: '1 day'     },
    { name: 'liquidation_fees_30day',   interval: '30 days',   startOffset: '365 days',   lag: '1 hour',    refreshInterval: '1 day'     },
  ];

  private readonly hsmRevenueCaggConfigs = [
    { name: 'hsm_revenue_1min',   interval: '1 minute',  startOffset: '10 minutes', lag: '1 minute',  refreshInterval: '1 minute'  },
    { name: 'hsm_revenue_5min',   interval: '5 minutes', startOffset: '1 hour',     lag: '5 minutes', refreshInterval: '5 minutes' },
    { name: 'hsm_revenue_10min',  interval: '10 minutes',startOffset: '2 hours',    lag: '10 minutes',refreshInterval: '10 minutes'},
    { name: 'hsm_revenue_30min',  interval: '30 minutes',startOffset: '6 hours',    lag: '30 minutes',refreshInterval: '30 minutes'},
    { name: 'hsm_revenue_1hour',  interval: '1 hour',    startOffset: '1 day',      lag: '1 hour',    refreshInterval: '1 hour'    },
    { name: 'hsm_revenue_6hour',  interval: '6 hours',   startOffset: '3 days',     lag: '6 hours',   refreshInterval: '6 hours'   },
    // 24hour: schedule_interval=1hour, end_offset=1hour to avoid day-skipping
    { name: 'hsm_revenue_24hour', interval: '1 day',     startOffset: '7 days',     lag: '1 hour',    refreshInterval: '1 hour'    },
    { name: 'hsm_revenue_7day',   interval: '7 days',    startOffset: '180 days',   lag: '1 hour',    refreshInterval: '1 day'     },
    { name: 'hsm_revenue_30day',  interval: '30 days',   startOffset: '365 days',   lag: '1 hour',    refreshInterval: '1 day'     },
  ];

  private readonly borrowAprCaggConfigs = [
    { name: 'borrow_apr_1min',   interval: '1 minute',  startOffset: '10 minutes', lag: '1 minute',  refreshInterval: '1 minute'  },
    { name: 'borrow_apr_5min',   interval: '5 minutes', startOffset: '1 hour',     lag: '5 minutes', refreshInterval: '5 minutes' },
    { name: 'borrow_apr_10min',  interval: '10 minutes',startOffset: '2 hours',    lag: '10 minutes',refreshInterval: '10 minutes'},
    { name: 'borrow_apr_30min',  interval: '30 minutes',startOffset: '6 hours',    lag: '30 minutes',refreshInterval: '30 minutes'},
    { name: 'borrow_apr_1hour',  interval: '1 hour',    startOffset: '1 day',      lag: '1 hour',    refreshInterval: '1 hour'    },
    { name: 'borrow_apr_6hour',  interval: '6 hours',   startOffset: '3 days',     lag: '6 hours',   refreshInterval: '6 hours'   },
    // 24hour: schedule_interval=1hour, end_offset=1hour to avoid day-skipping
    { name: 'borrow_apr_24hour', interval: '1 day',     startOffset: '7 days',     lag: '1 hour',    refreshInterval: '1 hour'    },
    { name: 'borrow_apr_7day',   interval: '7 days',    startOffset: '180 days',   lag: '1 hour',    refreshInterval: '1 day'     },
    { name: 'borrow_apr_30day',  interval: '30 days',   startOffset: '365 days',   lag: '1 hour',    refreshInterval: '1 day'     },
  ];

  private readonly hsmDeltaConfigs = [
    { name: 'hsm_revenue_delta_1min',   sourceName: 'hsm_revenue_1min',   interval: '1 minute'  },
    { name: 'hsm_revenue_delta_5min',   sourceName: 'hsm_revenue_5min',   interval: '5 minutes' },
    { name: 'hsm_revenue_delta_10min',  sourceName: 'hsm_revenue_10min',  interval: '10 minutes'},
    { name: 'hsm_revenue_delta_30min',  sourceName: 'hsm_revenue_30min',  interval: '30 minutes'},
    { name: 'hsm_revenue_delta_1hour',  sourceName: 'hsm_revenue_1hour',  interval: '1 hour'    },
    { name: 'hsm_revenue_delta_6hour',  sourceName: 'hsm_revenue_6hour',  interval: '6 hours'   },
    { name: 'hsm_revenue_delta_24hour', sourceName: 'hsm_revenue_24hour', interval: '1 day'     },
    { name: 'hsm_revenue_delta_7day',   sourceName: 'hsm_revenue_7day',   interval: '7 days'    },
    { name: 'hsm_revenue_delta_30day',  sourceName: 'hsm_revenue_30day',  interval: '30 days'   },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Enable TimescaleDB ─────────────────────────────────────────────
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`);

    // ── 2. swaps_raw hypertable ───────────────────────────────────────────
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
    await queryRunner.query(`SELECT create_hypertable('swaps_raw', 'time');`);
    await queryRunner.query(`CREATE INDEX idx_swaps_raw_block_height ON swaps_raw (block_height);`);
    await queryRunner.query(`CREATE INDEX idx_swaps_raw_filler_id ON swaps_raw (filler_id);`);
    await queryRunner.query(`CREATE INDEX idx_swaps_raw_fee_asset_ids ON swaps_raw USING GIN(fee_asset_ids);`);
    await queryRunner.query(`CREATE INDEX idx_swaps_raw_fee_by_recipient ON swaps_raw USING GIN(fee_by_recipient);`);

    // ── 3. money_market_raw hypertable ────────────────────────────────────
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
    await queryRunner.query(`SELECT create_hypertable('money_market_raw', 'time');`);
    await queryRunner.query(`CREATE INDEX idx_money_market_raw_block_height ON money_market_raw (block_height);`);
    await queryRunner.query(`CREATE INDEX idx_money_market_raw_liquidation_call_id ON money_market_raw (liquidation_call_id);`);
    await queryRunner.query(`CREATE INDEX idx_money_market_raw_fee_asset_ids ON money_market_raw USING GIN(fee_asset_ids);`);
    await queryRunner.query(`CREATE INDEX idx_money_market_raw_fee_by_transfer ON money_market_raw USING GIN(fee_by_transfer);`);

    // ── 4. hsm_revenue_raw hypertable ────────────────────────────────────
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
    await queryRunner.query(`SELECT create_hypertable('hsm_revenue_raw', 'time');`);
    await queryRunner.query(`CREATE INDEX idx_hsm_revenue_raw_block_height ON hsm_revenue_raw (block_height);`);

    // ── 5. borrow_apr_raw hypertable ─────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE borrow_apr_raw (
        time TIMESTAMPTZ NOT NULL,
        block_height INTEGER NOT NULL,
        event_id VARCHAR(255) NOT NULL,
        amount NUMERIC(78, 18) NOT NULL,
        direction VARCHAR(10) NOT NULL,
        asset_id VARCHAR(255) NOT NULL,
        fee_spot_prices JSONB NOT NULL DEFAULT '{}',
        ingested_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (time, block_height, event_id)
      );
    `);
    await queryRunner.query(`SELECT create_hypertable('borrow_apr_raw', 'time');`);
    await queryRunner.query(`CREATE INDEX idx_borrow_apr_raw_block_height ON borrow_apr_raw (block_height);`);

    // ── 6. Swap fee CAGGs (fees_*) ────────────────────────────────────────
    // Final definition: 9 fee types incl. asset_staking; asset/protocol/burned aggregates for compat
    for (const config of this.swapCaggConfigs) {
      await queryRunner.query(`
        CREATE MATERIALIZED VIEW ${config.name}
        WITH (timescaledb.continuous) AS
        SELECT
          time_bucket('${config.interval}', s.time) AS bucket,
          COALESCE(SUM(
            (fee_rec->>'amount')::numeric *
            COALESCE((s.fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0)
          ), 0) AS total_fee_usd,
          jsonb_build_object(
            'asset_referral',
            COALESCE(SUM(CASE WHEN (fee_rec->>'feeType') = 'asset_referral'
              THEN (fee_rec->>'amount')::numeric * COALESCE((s.fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0) ELSE 0 END), 0),
            'asset_omnipool',
            COALESCE(SUM(CASE WHEN (fee_rec->>'feeType') = 'asset_omnipool'
              THEN (fee_rec->>'amount')::numeric * COALESCE((s.fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0) ELSE 0 END), 0),
            'asset_staking',
            COALESCE(SUM(CASE WHEN (fee_rec->>'feeType') = 'asset_staking'
              THEN (fee_rec->>'amount')::numeric * COALESCE((s.fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0) ELSE 0 END), 0),
            'protocol_treasury',
            COALESCE(SUM(CASE WHEN (fee_rec->>'feeType') = 'protocol_treasury'
              THEN (fee_rec->>'amount')::numeric * COALESCE((s.fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0) ELSE 0 END), 0),
            'protocol_burned',
            COALESCE(SUM(CASE WHEN (fee_rec->>'feeType') = 'protocol_burned'
              THEN (fee_rec->>'amount')::numeric * COALESCE((s.fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0) ELSE 0 END), 0),
            'asset',
            COALESCE(SUM(CASE WHEN (fee_rec->>'feeType') IN ('asset_referral', 'asset_omnipool', 'asset_staking')
              THEN (fee_rec->>'amount')::numeric * COALESCE((s.fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0) ELSE 0 END), 0),
            'protocol',
            COALESCE(SUM(CASE WHEN (fee_rec->>'feeType') IN ('protocol_treasury', 'protocol_burned')
              THEN (fee_rec->>'amount')::numeric * COALESCE((s.fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0) ELSE 0 END), 0),
            'burned',
            COALESCE(SUM(CASE WHEN (fee_rec->>'feeType') = 'protocol_burned'
              THEN (fee_rec->>'amount')::numeric * COALESCE((s.fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0) ELSE 0 END), 0)
          ) AS fees_by_type,
          COUNT(DISTINCT s.swap_id) AS swap_count
        FROM swaps_raw s
        CROSS JOIN LATERAL jsonb_array_elements(s.fee_by_recipient) AS fee_rec
        WHERE jsonb_typeof(s.fee_spot_prices) = 'object'
          AND s.fee_spot_prices != '{}'::jsonb
        GROUP BY bucket
        WITH NO DATA;
      `);
      await queryRunner.query(`
        SELECT add_continuous_aggregate_policy('${config.name}',
          start_offset => INTERVAL '${config.startOffset}',
          end_offset   => INTERVAL '${config.lag}',
          schedule_interval => INTERVAL '${config.refreshInterval}');
      `);
    }

    // ── 7. Liquidation fee CAGGs (liquidation_fees_*) ────────────────────
    for (const config of this.liquidationCaggConfigs) {
      await queryRunner.query(`
        CREATE MATERIALIZED VIEW ${config.name}
        WITH (timescaledb.continuous) AS
        SELECT
          time_bucket('${config.interval}', m.time) AS bucket,
          SUM(
            CASE
              WHEN COALESCE((fee_transfer->>'countInTotal')::boolean, true) = true
              THEN (fee_transfer->>'amount')::numeric *
                   COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0)
              ELSE 0
            END
          ) AS total_liquidation_fee_usd,
          jsonb_build_object(
            'LIQUIDATION_PENALTY',
            COALESCE(SUM(CASE WHEN (fee_transfer->>'feeType') = 'LIQUIDATION_PENALTY'
              THEN (fee_transfer->>'amount')::numeric * COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0) ELSE 0 END), 0),
            'PEPL_LIQUIDATION_PROFIT',
            COALESCE(SUM(CASE WHEN (fee_transfer->>'feeType') = 'PEPL_LIQUIDATION_PROFIT'
              THEN (fee_transfer->>'amount')::numeric * COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0) ELSE 0 END), 0),
            'ASSET_RESERVE',
            COALESCE(SUM(CASE WHEN (fee_transfer->>'feeType') = 'ASSET_RESERVE'
              THEN (fee_transfer->>'amount')::numeric * COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0) ELSE 0 END), 0),
            'BORROW_APR',
            COALESCE(SUM(CASE WHEN (fee_transfer->>'feeType') = 'BORROW_APR'
              THEN (fee_transfer->>'amount')::numeric * COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0) ELSE 0 END), 0),
            'OTHER',
            COALESCE(SUM(CASE WHEN (fee_transfer->>'feeType') = 'OTHER'
              THEN (fee_transfer->>'amount')::numeric * COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0) ELSE 0 END), 0)
          ) AS fees_by_type,
          COUNT(DISTINCT m.liquidation_event_id) AS liquidation_count,
          COUNT(fee_transfer) AS transfer_count
        FROM money_market_raw m
        CROSS JOIN LATERAL jsonb_array_elements(m.fee_by_transfer) AS fee_transfer
        WHERE jsonb_typeof(m.fee_spot_prices) = 'object'
          AND m.fee_spot_prices != '{}'::jsonb
        GROUP BY bucket
        WITH NO DATA;
      `);
      await queryRunner.query(`
        SELECT add_continuous_aggregate_policy('${config.name}',
          start_offset => INTERVAL '${config.startOffset}',
          end_offset   => INTERVAL '${config.lag}',
          schedule_interval => INTERVAL '${config.refreshInterval}');
      `);
    }

    // ── 8. HSM revenue CAGGs (hsm_revenue_*) — AVG, not SUM ─────────────
    for (const config of this.hsmRevenueCaggConfigs) {
      await queryRunner.query(`
        CREATE MATERIALIZED VIEW ${config.name}
        WITH (timescaledb.continuous) AS
        SELECT
          time_bucket('${config.interval}', h.time) AS bucket,
          AVG(h.hsm_revenue) AS hsm_revenue,
          COUNT(*) AS event_count
        FROM hsm_revenue_raw h
        GROUP BY bucket
        WITH NO DATA;
      `);
      await queryRunner.query(`
        SELECT add_continuous_aggregate_policy('${config.name}',
          start_offset => INTERVAL '${config.startOffset}',
          end_offset   => INTERVAL '${config.lag}',
          schedule_interval => INTERVAL '${config.refreshInterval}');
      `);
    }

    // ── 9. Borrow APR CAGGs (borrow_apr_*) ───────────────────────────────
    for (const config of this.borrowAprCaggConfigs) {
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
          end_offset   => INTERVAL '${config.lag}',
          schedule_interval => INTERVAL '${config.refreshInterval}');
      `);
    }

    // ── 10. HSM delta hypertables ─────────────────────────────────────────
    for (const config of this.hsmDeltaConfigs) {
      await queryRunner.query(`
        CREATE TABLE ${config.name} (
          bucket TIMESTAMPTZ NOT NULL,
          hsm_revenue_delta NUMERIC,
          event_count INTEGER,
          PRIMARY KEY (bucket)
        );
      `);
      await queryRunner.query(`SELECT create_hypertable('${config.name}', 'bucket');`);
    }

    // ── 11. HSM delta functions and background job ────────────────────────

    // Full historical backfill (no time filter)
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.populate_hsm_revenue_delta_full(
        source_table TEXT,
        delta_table TEXT
      ) RETURNS VOID AS $$
      BEGIN
        EXECUTE format('
          WITH deltas AS (
            SELECT
              bucket,
              hsm_revenue - LAG(hsm_revenue) OVER (ORDER BY bucket) AS hsm_revenue_delta,
              event_count
            FROM %I
          )
          INSERT INTO %I (bucket, hsm_revenue_delta, event_count)
          SELECT bucket, hsm_revenue_delta, event_count
          FROM deltas
          WHERE hsm_revenue_delta IS NOT NULL
          ON CONFLICT (bucket) DO UPDATE SET
            hsm_revenue_delta = EXCLUDED.hsm_revenue_delta,
            event_count = EXCLUDED.event_count
        ', source_table, delta_table);
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Incremental refresh anchored on MAX(bucket) — self-heals after any gap
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.refresh_hsm_revenue_delta(
        source_table TEXT,
        delta_table TEXT,
        bucket_interval INTERVAL
      ) RETURNS VOID AS $$
      BEGIN
        EXECUTE format('
          WITH last_written AS (
            SELECT COALESCE(MAX(bucket), NOW() - %L::interval * 3) AS last_bucket
            FROM %I
          ),
          deltas AS (
            SELECT
              bucket,
              hsm_revenue - LAG(hsm_revenue) OVER (ORDER BY bucket) AS hsm_revenue_delta,
              event_count
            FROM %I
            WHERE bucket >= (SELECT last_bucket FROM last_written) - %L::interval
          )
          INSERT INTO %I (bucket, hsm_revenue_delta, event_count)
          SELECT bucket, hsm_revenue_delta, event_count
          FROM deltas
          WHERE hsm_revenue_delta IS NOT NULL
          ON CONFLICT (bucket) DO UPDATE SET
            hsm_revenue_delta = EXCLUDED.hsm_revenue_delta,
            event_count = EXCLUDED.event_count
        ', bucket_interval, delta_table, source_table, bucket_interval, delta_table);
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Scheduler procedure — add_job requires a PROCEDURE with (job_id INT, config JSONB)
    await queryRunner.query(`
      CREATE OR REPLACE PROCEDURE public.refresh_all_hsm_revenue_deltas(
        job_id INT DEFAULT NULL,
        config JSONB DEFAULT NULL
      )
      LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM public.refresh_hsm_revenue_delta('hsm_revenue_1min',   'hsm_revenue_delta_1min',   INTERVAL '1 minute');
        PERFORM public.refresh_hsm_revenue_delta('hsm_revenue_5min',   'hsm_revenue_delta_5min',   INTERVAL '5 minutes');
        PERFORM public.refresh_hsm_revenue_delta('hsm_revenue_10min',  'hsm_revenue_delta_10min',  INTERVAL '10 minutes');
        PERFORM public.refresh_hsm_revenue_delta('hsm_revenue_30min',  'hsm_revenue_delta_30min',  INTERVAL '30 minutes');
        PERFORM public.refresh_hsm_revenue_delta('hsm_revenue_1hour',  'hsm_revenue_delta_1hour',  INTERVAL '1 hour');
        PERFORM public.refresh_hsm_revenue_delta('hsm_revenue_6hour',  'hsm_revenue_delta_6hour',  INTERVAL '6 hours');
        PERFORM public.refresh_hsm_revenue_delta('hsm_revenue_24hour', 'hsm_revenue_delta_24hour', INTERVAL '1 day');
        PERFORM public.refresh_hsm_revenue_delta('hsm_revenue_7day',   'hsm_revenue_delta_7day',   INTERVAL '7 days');
        PERFORM public.refresh_hsm_revenue_delta('hsm_revenue_30day',  'hsm_revenue_delta_30day',  INTERVAL '30 days');
      END;
      $$;
    `);

    // Register background job (schema-qualified name required by TimescaleDB)
    await queryRunner.query(`
      SELECT add_job(
        'public.refresh_all_hsm_revenue_deltas',
        schedule_interval => INTERVAL '1 minute',
        initial_start => NOW()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove background job and HSM delta infrastructure first
    await queryRunner.query(`
      SELECT delete_job(job_id)
      FROM timescaledb_information.jobs
      WHERE proc_name = 'refresh_all_hsm_revenue_deltas'
        AND proc_schema = 'public';
    `);
    await queryRunner.query(`DROP PROCEDURE IF EXISTS public.refresh_all_hsm_revenue_deltas(INT, JSONB);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS public.refresh_hsm_revenue_delta(TEXT, TEXT, INTERVAL);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS public.populate_hsm_revenue_delta_full(TEXT, TEXT);`);

    for (const config of this.hsmDeltaConfigs) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${config.name} CASCADE;`);
    }

    // Drop all CAGGs (CASCADE removes policies automatically)
    for (const config of [...this.borrowAprCaggConfigs].reverse()) {
      await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS ${config.name} CASCADE;`);
    }
    for (const config of [...this.hsmRevenueCaggConfigs].reverse()) {
      await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS ${config.name} CASCADE;`);
    }
    for (const config of [...this.liquidationCaggConfigs].reverse()) {
      await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS ${config.name} CASCADE;`);
    }
    for (const config of [...this.swapCaggConfigs].reverse()) {
      await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS ${config.name} CASCADE;`);
    }

    // Drop raw hypertables
    await queryRunner.query(`DROP TABLE IF EXISTS borrow_apr_raw CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS hsm_revenue_raw CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS money_market_raw CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS swaps_raw CASCADE;`);
  }
}

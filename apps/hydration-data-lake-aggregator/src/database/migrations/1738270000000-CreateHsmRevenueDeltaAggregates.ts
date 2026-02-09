import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to create HSM revenue delta aggregates
 *
 * This creates a two-tier system:
 * - Tier 1 (existing): hsm_revenue_* continuous aggregates with AVG cumulative values
 * - Tier 2 (new): hsm_revenue_delta_* hypertables with materialized deltas between consecutive buckets
 *
 * The delta aggregates are populated by a background job that computes:
 * delta = AVG(current_bucket) - AVG(previous_bucket)
 *
 * This migration:
 * 1. Creates hsm_revenue_delta_* hypertables for all bucket sizes
 * 2. Creates a stored procedure to compute and populate deltas
 * 3. Sets up a TimescaleDB background job to refresh deltas periodically
 */
export class CreateHsmRevenueDeltaAggregates1738270000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const deltaIntervals = [
      {
        name: 'hsm_revenue_delta_1min',
        sourceName: 'hsm_revenue_1min',
        interval: '1 minute',
        refreshInterval: '1 minute',
        retention: '7 days',
      },
      {
        name: 'hsm_revenue_delta_5min',
        sourceName: 'hsm_revenue_5min',
        interval: '5 minutes',
        refreshInterval: '5 minutes',
        retention: '30 days',
      },
      {
        name: 'hsm_revenue_delta_10min',
        sourceName: 'hsm_revenue_10min',
        interval: '10 minutes',
        refreshInterval: '10 minutes',
        retention: '60 days',
      },
      {
        name: 'hsm_revenue_delta_30min',
        sourceName: 'hsm_revenue_30min',
        interval: '30 minutes',
        refreshInterval: '30 minutes',
        retention: '180 days',
      },
      {
        name: 'hsm_revenue_delta_1hour',
        sourceName: 'hsm_revenue_1hour',
        interval: '1 hour',
        refreshInterval: '1 hour',
        retention: '365 days',
      },
      {
        name: 'hsm_revenue_delta_6hour',
        sourceName: 'hsm_revenue_6hour',
        interval: '6 hours',
        refreshInterval: '6 hours',
        retention: '730 days',
      },
      {
        name: 'hsm_revenue_delta_24hour',
        sourceName: 'hsm_revenue_24hour',
        interval: '1 day',
        refreshInterval: '1 day',
        retention: '1095 days',
      },
      {
        name: 'hsm_revenue_delta_7day',
        sourceName: 'hsm_revenue_7day',
        interval: '7 days',
        refreshInterval: '1 day',
        retention: '1825 days',
      },
      {
        name: 'hsm_revenue_delta_30day',
        sourceName: 'hsm_revenue_30day',
        interval: '30 days',
        refreshInterval: '1 day',
        retention: '3650 days',
      },
    ];

    // Create hypertables for delta aggregates
    for (const config of deltaIntervals) {
      await queryRunner.query(`
        CREATE TABLE ${config.name} (
          bucket TIMESTAMPTZ NOT NULL,
          hsm_revenue_delta NUMERIC,
          event_count INTEGER,
          PRIMARY KEY (bucket)
        );
      `);

      await queryRunner.query(`
        SELECT create_hypertable('${config.name}', 'bucket');
      `);

      // Add retention policy
      // await queryRunner.query(`
      //   SELECT add_retention_policy('${config.name}', INTERVAL '${config.retention}');
      // `);
    }

    // Create stored procedure to compute deltas for a specific aggregate (incremental refresh)
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION refresh_hsm_revenue_delta(
        source_table TEXT,
        delta_table TEXT,
        bucket_interval INTERVAL
      ) RETURNS VOID AS $$
      BEGIN
        -- Compute deltas using LAG() window function and insert/update
        -- Only processes last 2 intervals for incremental updates
        EXECUTE format('
          WITH deltas AS (
            SELECT
              bucket,
              hsm_revenue - LAG(hsm_revenue) OVER (ORDER BY bucket) AS hsm_revenue_delta,
              event_count
            FROM %I
            WHERE bucket >= NOW() - INTERVAL ''%s'' * 2
          )
          INSERT INTO %I (bucket, hsm_revenue_delta, event_count)
          SELECT bucket, hsm_revenue_delta, event_count
          FROM deltas
          WHERE hsm_revenue_delta IS NOT NULL
          ON CONFLICT (bucket) DO UPDATE SET
            hsm_revenue_delta = EXCLUDED.hsm_revenue_delta,
            event_count = EXCLUDED.event_count
        ', source_table, bucket_interval, delta_table);
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create stored procedure for initial full population of deltas
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION populate_hsm_revenue_delta_full(
        source_table TEXT,
        delta_table TEXT
      ) RETURNS VOID AS $$
      BEGIN
        -- Compute deltas for ALL historical data (no time filter)
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

    // Create master refresh procedure that updates all delta tables (incremental)
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION refresh_all_hsm_revenue_deltas() RETURNS VOID AS $$
      BEGIN
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_1min', 'hsm_revenue_delta_1min', INTERVAL '1 minute');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_5min', 'hsm_revenue_delta_5min', INTERVAL '5 minutes');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_10min', 'hsm_revenue_delta_10min', INTERVAL '10 minutes');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_30min', 'hsm_revenue_delta_30min', INTERVAL '30 minutes');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_1hour', 'hsm_revenue_delta_1hour', INTERVAL '1 hour');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_6hour', 'hsm_revenue_delta_6hour', INTERVAL '6 hours');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_24hour', 'hsm_revenue_delta_24hour', INTERVAL '1 day');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_7day', 'hsm_revenue_delta_7day', INTERVAL '7 days');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_30day', 'hsm_revenue_delta_30day', INTERVAL '30 days');
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Initial population of all historical delta data
    for (const config of deltaIntervals) {
      await queryRunner.query(`
        SELECT populate_hsm_revenue_delta_full('${config.sourceName}', '${config.name}');
      `);
    }

    // Create TimescaleDB background job to refresh deltas every minute
    await queryRunner.query(`
      SELECT add_job(
        'refresh_all_hsm_revenue_deltas',
        schedule_interval => INTERVAL '1 minute',
        initial_start => NOW()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const deltaIntervals = [
      'hsm_revenue_delta_1min',
      'hsm_revenue_delta_5min',
      'hsm_revenue_delta_10min',
      'hsm_revenue_delta_30min',
      'hsm_revenue_delta_1hour',
      'hsm_revenue_delta_6hour',
      'hsm_revenue_delta_24hour',
      'hsm_revenue_delta_7day',
      'hsm_revenue_delta_30day',
    ];

    // Remove background job
    await queryRunner.query(`
      SELECT delete_job(job_id)
      FROM timescaledb_information.jobs
      WHERE proc_name = 'refresh_all_hsm_revenue_deltas';
    `);

    // Drop stored procedures
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS refresh_all_hsm_revenue_deltas();
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS refresh_hsm_revenue_delta(TEXT, TEXT, INTERVAL);
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS populate_hsm_revenue_delta_full(TEXT, TEXT);
    `);

    // Drop delta hypertables
    for (const tableName of deltaIntervals) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${tableName} CASCADE;`);
    }
  }
}
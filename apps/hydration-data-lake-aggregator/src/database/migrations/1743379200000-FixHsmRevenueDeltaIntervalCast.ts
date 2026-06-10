import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fixes refresh_hsm_revenue_delta: %L renders INTERVAL as a string literal
 * ('00:01:00'), which PostgreSQL cannot multiply as an integer.
 * Adding ::interval casts makes the arithmetic valid.
 */
export class FixHsmRevenueDeltaIntervalCast1743379200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore the broken version (without ::interval casts)
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.refresh_hsm_revenue_delta(
        source_table TEXT,
        delta_table TEXT,
        bucket_interval INTERVAL
      ) RETURNS VOID AS $$
      BEGIN
        EXECUTE format('
          WITH last_written AS (
            SELECT COALESCE(MAX(bucket), NOW() - %L * 3) AS last_bucket
            FROM %I
          ),
          deltas AS (
            SELECT
              bucket,
              hsm_revenue - LAG(hsm_revenue) OVER (ORDER BY bucket) AS hsm_revenue_delta,
              event_count
            FROM %I
            WHERE bucket >= (SELECT last_bucket FROM last_written) - %L
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
  }
}

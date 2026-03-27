import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fixes four bugs in CreateHsmRevenueDeltaAggregates:
 *
 * Bug 1: refresh_all_hsm_revenue_deltas was a FUNCTION — TimescaleDB add_job
 *   requires a PROCEDURE with (job_id INT, config JSONB) signature, causing
 *   "cache lookup failed for function 0" on every job run.
 *
 * Bug 2: add_job used an unqualified name — must be schema-qualified
 *   ('public.refresh_all_hsm_revenue_deltas') to resolve correctly.
 *
 * Bug 3: populate_hsm_revenue_delta_full was called without first refreshing
 *   the source CAGGs, so on a fresh deploy all delta tables seed as empty.
 *
 * Bug 4: down() dropped a FUNCTION instead of PROCEDURE, and the delete_job
 *   query lacked proc_schema filter.
 */
export class FixHsmRevenueDeltaJob1738700000000 implements MigrationInterface {
  // refresh_continuous_aggregate() cannot run inside a transaction block
  public transaction = false;

  private readonly deltaIntervals = [
    {
      name: 'hsm_revenue_delta_1min',
      sourceName: 'hsm_revenue_1min',
      interval: '1 minute',
    },
    {
      name: 'hsm_revenue_delta_5min',
      sourceName: 'hsm_revenue_5min',
      interval: '5 minutes',
    },
    {
      name: 'hsm_revenue_delta_10min',
      sourceName: 'hsm_revenue_10min',
      interval: '10 minutes',
    },
    {
      name: 'hsm_revenue_delta_30min',
      sourceName: 'hsm_revenue_30min',
      interval: '30 minutes',
    },
    {
      name: 'hsm_revenue_delta_1hour',
      sourceName: 'hsm_revenue_1hour',
      interval: '1 hour',
    },
    {
      name: 'hsm_revenue_delta_6hour',
      sourceName: 'hsm_revenue_6hour',
      interval: '6 hours',
    },
    {
      name: 'hsm_revenue_delta_24hour',
      sourceName: 'hsm_revenue_24hour',
      interval: '1 day',
    },
    {
      name: 'hsm_revenue_delta_7day',
      sourceName: 'hsm_revenue_7day',
      interval: '7 days',
    },
    {
      name: 'hsm_revenue_delta_30day',
      sourceName: 'hsm_revenue_30day',
      interval: '30 days',
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove broken job(s) registered against the old function (any job_id)
    await queryRunner.query(`
      SELECT delete_job(job_id)
      FROM timescaledb_information.jobs
      WHERE proc_name = 'refresh_all_hsm_revenue_deltas'
        AND proc_schema = 'public';
    `);

    // Drop the old FUNCTION (Bug 1 — wrong object type)
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.refresh_all_hsm_revenue_deltas();
    `);

    // Drop any leftover overloads from failed fix attempts
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.refresh_all_hsm_revenue_deltas(JSONB);
    `);

    // Bug 1 fix: recreate as PROCEDURE with required scheduler signature
    await queryRunner.query(`
      CREATE OR REPLACE PROCEDURE public.refresh_all_hsm_revenue_deltas(
        job_id INT DEFAULT NULL,
        config JSONB DEFAULT NULL
      )
      LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_1min',   'hsm_revenue_delta_1min',   INTERVAL '1 minute');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_5min',   'hsm_revenue_delta_5min',   INTERVAL '5 minutes');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_10min',  'hsm_revenue_delta_10min',  INTERVAL '10 minutes');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_30min',  'hsm_revenue_delta_30min',  INTERVAL '30 minutes');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_1hour',  'hsm_revenue_delta_1hour',  INTERVAL '1 hour');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_6hour',  'hsm_revenue_delta_6hour',  INTERVAL '6 hours');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_24hour', 'hsm_revenue_delta_24hour', INTERVAL '1 day');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_7day',   'hsm_revenue_delta_7day',   INTERVAL '7 days');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_30day',  'hsm_revenue_delta_30day',  INTERVAL '30 days');
      END;
      $$;
    `);

    // Bug 3 fix: force-refresh each source CAGG before re-seeding its delta table
    for (const config of this.deltaIntervals) {
      await queryRunner.query(
        `CALL refresh_continuous_aggregate('${config.sourceName}', NULL, NULL);`,
      );
      await queryRunner.query(
        `SELECT populate_hsm_revenue_delta_full('${config.sourceName}', '${config.name}');`,
      );
    }

    // Bug 2 fix: register with schema-qualified name
    await queryRunner.query(`
      SELECT add_job(
        'public.refresh_all_hsm_revenue_deltas',
        schedule_interval => INTERVAL '1 minute',
        initial_start => NOW()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Bug 4 fix: delete_job with proc_schema filter, drop PROCEDURE not FUNCTION
    await queryRunner.query(`
      SELECT delete_job(job_id)
      FROM timescaledb_information.jobs
      WHERE proc_name = 'refresh_all_hsm_revenue_deltas'
        AND proc_schema = 'public';
    `);

    await queryRunner.query(`
      DROP PROCEDURE IF EXISTS public.refresh_all_hsm_revenue_deltas(INT, JSONB);
    `);

    // Restore the original broken function so the previous migration's down() still works
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.refresh_all_hsm_revenue_deltas() RETURNS VOID AS $$
      BEGIN
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_1min',   'hsm_revenue_delta_1min',   INTERVAL '1 minute');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_5min',   'hsm_revenue_delta_5min',   INTERVAL '5 minutes');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_10min',  'hsm_revenue_delta_10min',  INTERVAL '10 minutes');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_30min',  'hsm_revenue_delta_30min',  INTERVAL '30 minutes');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_1hour',  'hsm_revenue_delta_1hour',  INTERVAL '1 hour');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_6hour',  'hsm_revenue_delta_6hour',  INTERVAL '6 hours');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_24hour', 'hsm_revenue_delta_24hour', INTERVAL '1 day');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_7day',   'hsm_revenue_delta_7day',   INTERVAL '7 days');
        PERFORM refresh_hsm_revenue_delta('hsm_revenue_30day',  'hsm_revenue_delta_30day',  INTERVAL '30 days');
      END;
      $$ LANGUAGE plpgsql;
    `);
  }
}

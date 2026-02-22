import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to add 7-day and 30-day continuous aggregates for Borrow APR
 *
 * Adds:
 * - borrow_apr_7day
 * - borrow_apr_30day
 */
export class AddBorrowAprSevenDayThirtyDayBuckets1738400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // BORROW APR - 7 DAY AND 30 DAY
    // ============================================================

    // borrow_apr_7day
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW borrow_apr_7day
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('7 days', b.time) AS bucket,
        SUM(b.amount * COALESCE((b.fee_spot_prices->>(b.asset_id))::numeric, 0)) AS borrow_apr,
        COUNT(*) AS event_count
      FROM borrow_apr_raw b
      GROUP BY bucket
      WITH NO DATA;
    `);

    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy('borrow_apr_7day',
        start_offset => INTERVAL '180 days',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 day');
    `);

    // borrow_apr_30day
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW borrow_apr_30day
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('30 days', b.time) AS bucket,
        SUM(b.amount * COALESCE((b.fee_spot_prices->>(b.asset_id))::numeric, 0)) AS borrow_apr,
        COUNT(*) AS event_count
      FROM borrow_apr_raw b
      GROUP BY bucket
      WITH NO DATA;
    `);

    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy('borrow_apr_30day',
        start_offset => INTERVAL '365 days',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 day');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all created continuous aggregates
    await queryRunner.query(
      `DROP MATERIALIZED VIEW IF EXISTS borrow_apr_7day CASCADE;`,
    );
    await queryRunner.query(
      `DROP MATERIALIZED VIEW IF EXISTS borrow_apr_30day CASCADE;`,
    );
  }
}
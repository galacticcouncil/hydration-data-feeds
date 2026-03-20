import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Updates all 24-hour continuous aggregate refresh policies to run hourly.
 *
 * Previous config caused day-skipping: with schedule_interval=1day and end_offset=1day,
 * the scheduler could miss days if delayed (e.g. by a crashing background job).
 *
 * New config: schedule_interval=1hour, end_offset=1hour — checks every hour and
 * materializes any completed daily buckets within 1 hour of them closing.
 */
export class Update24HourBucketPolicies1738600000000
  implements MigrationInterface
{
  private readonly views = [
    'fees_24hour',
    'liquidation_fees_24hour',
    'hsm_revenue_24hour',
    'borrow_apr_24hour',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const view of this.views) {
      await queryRunner.query(
        `SELECT remove_continuous_aggregate_policy('${view}');`,
      );
      await queryRunner.query(`
        SELECT add_continuous_aggregate_policy('${view}',
          start_offset => INTERVAL '7 days',
          end_offset   => INTERVAL '1 hour',
          schedule_interval => INTERVAL '1 hour');
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const view of this.views) {
      await queryRunner.query(
        `SELECT remove_continuous_aggregate_policy('${view}');`,
      );
      await queryRunner.query(`
        SELECT add_continuous_aggregate_policy('${view}',
          start_offset => INTERVAL '7 days',
          end_offset   => INTERVAL '1 day',
          schedule_interval => INTERVAL '1 day');
      `);
    }
  }
}

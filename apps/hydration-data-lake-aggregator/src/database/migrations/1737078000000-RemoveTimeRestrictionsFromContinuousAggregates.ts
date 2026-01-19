import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveTimeRestrictionsFromContinuousAggregates1737078000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    /**
     * Remove time restrictions from continuous aggregate refresh policies
     * This allows aggregates to process ALL enriched historical data, not just recent data
     *
     * Previous start_offset values were limiting aggregation windows:
     * - fees_1min: 1 hour (now: unlimited)
     * - fees_5min: 6 hours (now: unlimited)
     * - fees_10min: 12 hours (now: unlimited)
     * - fees_30min: 1 day (now: unlimited)
     * - fees_1hour: 7 days (now: unlimited)
     * - fees_5hour: 30 days (now: unlimited)
     * - fees_1day: 365 days (now: unlimited)
     */

    const aggregates = [
      {
        name: 'fees_1min',
        refreshInterval: '1 minute',
        lag: '2 minutes',
      },
      {
        name: 'fees_5min',
        refreshInterval: '5 minutes',
        lag: '5 minutes',
      },
      {
        name: 'fees_10min',
        refreshInterval: '10 minutes',
        lag: '10 minutes',
      },
      {
        name: 'fees_30min',
        refreshInterval: '30 minutes',
        lag: '30 minutes',
      },
      {
        name: 'fees_1hour',
        refreshInterval: '1 hour',
        lag: '1 hour',
      },
      {
        name: 'fees_5hour',
        refreshInterval: '5 hours',
        lag: '5 hours',
      },
      {
        name: 'fees_1day',
        refreshInterval: '12 hours',
        lag: '1 day',
      },
    ];

    for (const config of aggregates) {
      // Remove existing refresh policy
      await queryRunner.query(`
        SELECT remove_continuous_aggregate_policy('${config.name}');
      `);

      // Add new refresh policy with NULL start_offset (processes all data)
      await queryRunner.query(`
        SELECT add_continuous_aggregate_policy('${config.name}',
          start_offset => NULL,
          end_offset => INTERVAL '${config.lag}',
          schedule_interval => INTERVAL '${config.refreshInterval}');
      `);
    }

    /**
     * Note: Manual refresh is not performed here because it cannot run inside a transaction.
     * The automatic refresh policies will backfill historical data on their next scheduled run.
     * To manually trigger an immediate refresh after migration, run:
     *   CALL refresh_continuous_aggregate('fees_1min', NULL, NULL);
     *   CALL refresh_continuous_aggregate('fees_5min', NULL, NULL);
     *   ... (for each aggregate)
     */
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore original time-restricted refresh policies
    const aggregates = [
      {
        name: 'fees_1min',
        refreshInterval: '1 minute',
        lag: '2 minutes',
        startOffset: '1 hour',
      },
      {
        name: 'fees_5min',
        refreshInterval: '5 minutes',
        lag: '5 minutes',
        startOffset: '6 hours',
      },
      {
        name: 'fees_10min',
        refreshInterval: '10 minutes',
        lag: '10 minutes',
        startOffset: '12 hours',
      },
      {
        name: 'fees_30min',
        refreshInterval: '30 minutes',
        lag: '30 minutes',
        startOffset: '1 day',
      },
      {
        name: 'fees_1hour',
        refreshInterval: '1 hour',
        lag: '1 hour',
        startOffset: '7 days',
      },
      {
        name: 'fees_5hour',
        refreshInterval: '5 hours',
        lag: '5 hours',
        startOffset: '30 days',
      },
      {
        name: 'fees_1day',
        refreshInterval: '12 hours',
        lag: '1 day',
        startOffset: '365 days',
      },
    ];

    for (const config of aggregates) {
      // Remove current policy
      await queryRunner.query(`
        SELECT remove_continuous_aggregate_policy('${config.name}');
      `);

      // Restore original time-restricted policy
      await queryRunner.query(`
        SELECT add_continuous_aggregate_policy('${config.name}',
          start_offset => INTERVAL '${config.startOffset}',
          end_offset => INTERVAL '${config.lag}',
          schedule_interval => INTERVAL '${config.refreshInterval}');
      `);
    }
  }
}

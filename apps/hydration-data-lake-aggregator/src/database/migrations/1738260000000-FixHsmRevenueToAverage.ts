import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to fix HSM revenue continuous aggregates to use AVG instead of SUM
 *
 * HSM revenue is a trend/level metric (cumulative balance snapshot), not a flow metric.
 * Therefore, buckets should show the AVERAGE value during that period, not the SUM.
 *
 * This migration:
 * 1. Drops existing hsm_revenue_* continuous aggregates (1min through 30day)
 * 2. Recreates them with AVG aggregation directly from hsm_revenue_raw
 * 3. Restores refresh policies and retention policies
 */
export class FixHsmRevenueToAverage1738260000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hsmRevenueIntervals = [
      {
        name: 'hsm_revenue_1min',
        interval: '1 minute',
        refreshInterval: '1 minute',
        lag: '1 minute',
        startOffset: '10 minutes',
      },
      {
        name: 'hsm_revenue_5min',
        interval: '5 minutes',
        refreshInterval: '5 minutes',
        lag: '5 minutes',
        startOffset: '1 hour',
      },
      {
        name: 'hsm_revenue_10min',
        interval: '10 minutes',
        refreshInterval: '10 minutes',
        lag: '10 minutes',
        startOffset: '2 hours',
      },
      {
        name: 'hsm_revenue_30min',
        interval: '30 minutes',
        refreshInterval: '30 minutes',
        lag: '30 minutes',
        startOffset: '6 hours',
      },
      {
        name: 'hsm_revenue_1hour',
        interval: '1 hour',
        refreshInterval: '1 hour',
        lag: '1 hour',
        startOffset: '1 day',
      },
      {
        name: 'hsm_revenue_6hour',
        interval: '6 hours',
        refreshInterval: '6 hours',
        lag: '6 hours',
        startOffset: '3 days',
      },
      {
        name: 'hsm_revenue_24hour',
        interval: '1 day',
        refreshInterval: '1 day',
        lag: '1 day',
        startOffset: '7 days',
      },
      {
        name: 'hsm_revenue_7day',
        interval: '7 days',
        refreshInterval: '1 day',
        lag: '1 hour',
        startOffset: '180 days',
      },
      {
        name: 'hsm_revenue_30day',
        interval: '30 days',
        refreshInterval: '1 day',
        lag: '1 hour',
        startOffset: '365 days',
      },
    ];

    // Drop existing continuous aggregates
    for (const config of hsmRevenueIntervals) {
      await queryRunner.query(
        `DROP MATERIALIZED VIEW IF EXISTS ${config.name} CASCADE;`,
      );
    }

    // Recreate continuous aggregates with AVG instead of SUM
    for (const config of hsmRevenueIntervals) {
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

      // Add refresh policy
      await queryRunner.query(`
        SELECT add_continuous_aggregate_policy('${config.name}',
          start_offset => INTERVAL '${config.startOffset}',
          end_offset => INTERVAL '${config.lag}',
          schedule_interval => INTERVAL '${config.refreshInterval}');
      `);

      // Add retention policy if specified
      // if (config.retentionPolicy) {
      //   await queryRunner.query(`
      //     SELECT add_retention_policy('${config.name}', INTERVAL '${config.retentionPolicy}');
      //   `);
      // }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hsmRevenueIntervals = [
      {
        name: 'hsm_revenue_1min',
        interval: '1 minute',
        refreshInterval: '1 minute',
        lag: '1 minute',
        startOffset: '10 minutes',
      },
      {
        name: 'hsm_revenue_5min',
        interval: '5 minutes',
        refreshInterval: '5 minutes',
        lag: '5 minutes',
        startOffset: '1 hour',
      },
      {
        name: 'hsm_revenue_10min',
        interval: '10 minutes',
        refreshInterval: '10 minutes',
        lag: '10 minutes',
        startOffset: '2 hours',
      },
      {
        name: 'hsm_revenue_30min',
        interval: '30 minutes',
        refreshInterval: '30 minutes',
        lag: '30 minutes',
        startOffset: '6 hours',
      },
      {
        name: 'hsm_revenue_1hour',
        interval: '1 hour',
        refreshInterval: '1 hour',
        lag: '1 hour',
        startOffset: '1 day',
      },
      {
        name: 'hsm_revenue_6hour',
        interval: '6 hours',
        refreshInterval: '6 hours',
        lag: '6 hours',
        startOffset: '3 days',
      },
      {
        name: 'hsm_revenue_24hour',
        interval: '1 day',
        refreshInterval: '1 day',
        lag: '1 day',
        startOffset: '7 days',
      },
      {
        name: 'hsm_revenue_7day',
        interval: '7 days',
        refreshInterval: '1 day',
        lag: '1 hour',
        startOffset: '180 days',
      },
      {
        name: 'hsm_revenue_30day',
        interval: '30 days',
        refreshInterval: '1 day',
        lag: '1 hour',
        startOffset: '365 days',
      },
    ];

    // Drop AVG-based continuous aggregates
    for (const config of hsmRevenueIntervals) {
      await queryRunner.query(
        `DROP MATERIALIZED VIEW IF EXISTS ${config.name} CASCADE;`,
      );
    }

    // Restore original SUM-based continuous aggregates
    for (const config of hsmRevenueIntervals) {
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

      // Add refresh policy
      await queryRunner.query(`
        SELECT add_continuous_aggregate_policy('${config.name}',
          start_offset => INTERVAL '${config.startOffset}',
          end_offset => INTERVAL '${config.lag}',
          schedule_interval => INTERVAL '${config.refreshInterval}');
      `);
    }
  }
}

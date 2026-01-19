import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixContinuousAggregateJsonbCasting1736863071000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop existing continuous aggregates (in reverse order)
    const aggregates = [
      'fees_1day',
      'fees_5hour',
      'fees_1hour',
      'fees_30min',
      'fees_10min',
      'fees_5min',
      'fees_1min',
    ];

    for (const aggregate of aggregates) {
      await queryRunner.query(
        `DROP MATERIALIZED VIEW IF EXISTS ${aggregate} CASCADE;`,
      );
    }

    // Recreate continuous aggregates with correct JSONB extraction (using ->> instead of ->)
    const intervals = [
      {
        name: 'fees_1min',
        interval: '1 minute',
        refreshInterval: '1 minute',
        lag: '2 minutes',
        startOffset: '1 hour',
        retention: '3 days',
      },
      {
        name: 'fees_5min',
        interval: '5 minutes',
        refreshInterval: '5 minutes',
        lag: '5 minutes',
        startOffset: '6 hours',
        retention: '7 days',
      },
      {
        name: 'fees_10min',
        interval: '10 minutes',
        refreshInterval: '10 minutes',
        lag: '10 minutes',
        startOffset: '12 hours',
        retention: '14 days',
      },
      {
        name: 'fees_30min',
        interval: '30 minutes',
        refreshInterval: '30 minutes',
        lag: '30 minutes',
        startOffset: '1 day',
        retention: '30 days',
      },
      {
        name: 'fees_1hour',
        interval: '1 hour',
        refreshInterval: '1 hour',
        lag: '1 hour',
        startOffset: '7 days',
        retention: '90 days',
      },
      {
        name: 'fees_5hour',
        interval: '5 hours',
        refreshInterval: '5 hours',
        lag: '5 hours',
        startOffset: '30 days',
        retention: '180 days',
      },
      {
        name: 'fees_1day',
        interval: '1 day',
        refreshInterval: '12 hours',
        lag: '1 day',
        startOffset: '365 days',
        retention: null, // No retention - keep indefinitely
      },
    ];

    for (const config of intervals) {
      // Create continuous aggregate with FIXED JSONB extraction (->> instead of ->)
      await queryRunner.query(`
        CREATE MATERIALIZED VIEW ${config.name}
        WITH (timescaledb.continuous) AS
        SELECT
          time_bucket('${config.interval}', time) AS bucket,

          -- Total fees in USD (sum of all fees)
          -- FIX: Changed -> to ->> for JSONB extraction before casting to numeric
          SUM(
            (fee_rec->>'amount')::numeric *
            COALESCE((fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0)
          ) AS total_fee_usd,

          -- Fees by type (JSONB object with { asset: X, protocol: Y, burned: Z })
          jsonb_build_object(
            'asset',
            COALESCE(SUM(
              CASE
                WHEN (fee_rec->>'feeType') = 'asset'
                THEN (fee_rec->>'amount')::numeric *
                     COALESCE((fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0)
                ELSE 0
              END
            ), 0),
            'protocol',
            COALESCE(SUM(
              CASE
                WHEN (fee_rec->>'feeType') = 'protocol'
                THEN (fee_rec->>'amount')::numeric *
                     COALESCE((fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0)
                ELSE 0
              END
            ), 0),
            'burned',
            COALESCE(SUM(
              CASE
                WHEN (fee_rec->>'feeType') = 'burned'
                THEN (fee_rec->>'amount')::numeric *
                     COALESCE((fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0)
                ELSE 0
              END
            ), 0)
          ) AS fees_by_type,

          -- Swap count (distinct swaps)
          COUNT(DISTINCT swap_id) AS swap_count

        FROM swaps_raw
        CROSS JOIN LATERAL jsonb_array_elements(fee_by_recipient) AS fee_rec

        WHERE fee_spot_prices IS NOT NULL

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

      // Add retention policy (if specified)
      if (config.retention) {
        await queryRunner.query(`
          SELECT add_retention_policy('${config.name}', INTERVAL '${config.retention}');
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop continuous aggregates
    await queryRunner.query(
      `DROP MATERIALIZED VIEW IF EXISTS fees_1day CASCADE;`,
    );
    await queryRunner.query(
      `DROP MATERIALIZED VIEW IF EXISTS fees_5hour CASCADE;`,
    );
    await queryRunner.query(
      `DROP MATERIALIZED VIEW IF EXISTS fees_1hour CASCADE;`,
    );
    await queryRunner.query(
      `DROP MATERIALIZED VIEW IF EXISTS fees_30min CASCADE;`,
    );
    await queryRunner.query(
      `DROP MATERIALIZED VIEW IF EXISTS fees_10min CASCADE;`,
    );
    await queryRunner.query(
      `DROP MATERIALIZED VIEW IF EXISTS fees_5min CASCADE;`,
    );
    await queryRunner.query(
      `DROP MATERIALIZED VIEW IF EXISTS fees_1min CASCADE;`,
    );
  }
}

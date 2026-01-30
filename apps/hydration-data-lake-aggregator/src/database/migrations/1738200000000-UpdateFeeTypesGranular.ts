import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to update fee types from 3 types to 4 granular types
 *
 * Old types: asset, protocol, burned
 * New types: asset_referral, asset_omnipool, protocol_treasury, protocol_burned
 *
 * This migration:
 * 1. Drops existing continuous aggregates (fees_*)
 * 2. Recreates them with granular fee type aggregation
 * 3. Maintains backward compatibility by also providing aggregated views
 */
export class UpdateFeeTypesGranular1738200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Configuration for all continuous aggregates
    const caggConfigs = [
      {
        name: 'fees_1min',
        interval: '1 minute',
        startOffset: '2 hours',
        lag: '1 minute',
        refreshInterval: '1 minute',
      },
      {
        name: 'fees_5min',
        interval: '5 minutes',
        startOffset: '12 hours',
        lag: '5 minutes',
        refreshInterval: '5 minutes',
      },
      {
        name: 'fees_10min',
        interval: '10 minutes',
        startOffset: '1 day',
        lag: '10 minutes',
        refreshInterval: '10 minutes',
      },
      {
        name: 'fees_30min',
        interval: '30 minutes',
        startOffset: '3 days',
        lag: '30 minutes',
        refreshInterval: '30 minutes',
      },
      {
        name: 'fees_1hour',
        interval: '1 hour',
        startOffset: '7 days',
        lag: '1 hour',
        refreshInterval: '1 hour',
      },
      {
        name: 'fees_6hour',
        interval: '6 hours',
        startOffset: '30 days',
        lag: '6 hours',
        refreshInterval: '6 hours',
      },
      {
        name: 'fees_24hour',
        interval: '24 hours',
        startOffset: '90 days',
        lag: '24 hours',
        refreshInterval: '24 hours',
      },
    ];

    // Drop all existing continuous aggregates
    for (const config of caggConfigs) {
      await queryRunner.query(
        `DROP MATERIALIZED VIEW IF EXISTS ${config.name} CASCADE;`,
      );
    }

    // Recreate continuous aggregates with granular fee types
    for (const config of caggConfigs) {
      await queryRunner.query(`
        CREATE MATERIALIZED VIEW ${config.name}
        WITH (timescaledb.continuous) AS
        SELECT
          time_bucket('${config.interval}', s.time) AS bucket,

          -- Total fee in USD (sum of all fee types)
          COALESCE(SUM(
            (fee_rec->>'amount')::numeric *
            COALESCE((s.fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0)
          ), 0) AS total_fee_usd,

          -- Granular fee types aggregation
          jsonb_build_object(
            'asset_referral',
            COALESCE(SUM(
              CASE
                WHEN (fee_rec->>'feeType') = 'asset_referral'
                THEN (fee_rec->>'amount')::numeric *
                     COALESCE((s.fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0)
                ELSE 0
              END
            ), 0),
            'asset_omnipool',
            COALESCE(SUM(
              CASE
                WHEN (fee_rec->>'feeType') = 'asset_omnipool'
                THEN (fee_rec->>'amount')::numeric *
                     COALESCE((s.fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0)
                ELSE 0
              END
            ), 0),
            'protocol_treasury',
            COALESCE(SUM(
              CASE
                WHEN (fee_rec->>'feeType') = 'protocol_treasury'
                THEN (fee_rec->>'amount')::numeric *
                     COALESCE((s.fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0)
                ELSE 0
              END
            ), 0),
            'protocol_burned',
            COALESCE(SUM(
              CASE
                WHEN (fee_rec->>'feeType') = 'protocol_burned'
                THEN (fee_rec->>'amount')::numeric *
                     COALESCE((s.fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0)
                ELSE 0
              END
            ), 0),
            -- Aggregated types for backward compatibility
            'asset',
            COALESCE(SUM(
              CASE
                WHEN (fee_rec->>'feeType') IN ('asset_referral', 'asset_omnipool')
                THEN (fee_rec->>'amount')::numeric *
                     COALESCE((s.fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0)
                ELSE 0
              END
            ), 0),
            'protocol',
            COALESCE(SUM(
              CASE
                WHEN (fee_rec->>'feeType') IN ('protocol_treasury', 'protocol_burned')
                THEN (fee_rec->>'amount')::numeric *
                     COALESCE((s.fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0)
                ELSE 0
              END
            ), 0),
            'burned',
            COALESCE(SUM(
              CASE
                WHEN (fee_rec->>'feeType') = 'protocol_burned'
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

      // Add refresh policy
      await queryRunner.query(`
        SELECT add_continuous_aggregate_policy('${config.name}',
          start_offset => INTERVAL '${config.startOffset}',
          end_offset => INTERVAL '${config.lag}',
          schedule_interval => INTERVAL '${config.refreshInterval}');
      `);

      // Add retention policy (30 days for 1min, 90 days for others)
      const retentionDays = config.name === 'fees_1min' ? 30 : 90;
      await queryRunner.query(`
        SELECT add_retention_policy('${config.name}', INTERVAL '${retentionDays} days');
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Configuration for all continuous aggregates
    const caggConfigs = [
      {
        name: 'fees_1min',
        interval: '1 minute',
        startOffset: '2 hours',
        lag: '1 minute',
        refreshInterval: '1 minute',
      },
      {
        name: 'fees_5min',
        interval: '5 minutes',
        startOffset: '12 hours',
        lag: '5 minutes',
        refreshInterval: '5 minutes',
      },
      {
        name: 'fees_10min',
        interval: '10 minutes',
        startOffset: '1 day',
        lag: '10 minutes',
        refreshInterval: '10 minutes',
      },
      {
        name: 'fees_30min',
        interval: '30 minutes',
        startOffset: '3 days',
        lag: '30 minutes',
        refreshInterval: '30 minutes',
      },
      {
        name: 'fees_1hour',
        interval: '1 hour',
        startOffset: '7 days',
        lag: '1 hour',
        refreshInterval: '1 hour',
      },
      {
        name: 'fees_6hour',
        interval: '6 hours',
        startOffset: '30 days',
        lag: '6 hours',
        refreshInterval: '6 hours',
      },
      {
        name: 'fees_24hour',
        interval: '24 hours',
        startOffset: '90 days',
        lag: '24 hours',
        refreshInterval: '24 hours',
      },
    ];

    // Drop granular continuous aggregates
    for (const config of caggConfigs) {
      await queryRunner.query(
        `DROP MATERIALIZED VIEW IF EXISTS ${config.name} CASCADE;`,
      );
    }

    // Recreate original continuous aggregates with old fee types
    for (const config of caggConfigs) {
      await queryRunner.query(`
        CREATE MATERIALIZED VIEW ${config.name}
        WITH (timescaledb.continuous) AS
        SELECT
          time_bucket('${config.interval}', s.time) AS bucket,

          -- Total fee in USD
          COALESCE(SUM(
            (fee_rec->>'amount')::numeric *
            COALESCE((s.fee_spot_prices->>(fee_rec->>'assetId'))::numeric, 0)
          ), 0) AS total_fee_usd,

          -- Old fee types (asset, protocol, burned)
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

      // Add refresh policy
      await queryRunner.query(`
        SELECT add_continuous_aggregate_policy('${config.name}',
          start_offset => INTERVAL '${config.startOffset}',
          end_offset => INTERVAL '${config.lag}',
          schedule_interval => INTERVAL '${config.refreshInterval}');
      `);

      // Add retention policy
      const retentionDays = config.name === 'fees_1min' ? 30 : 90;
      await queryRunner.query(`
        SELECT add_retention_policy('${config.name}', INTERVAL '${retentionDays} days');
      `);
    }
  }
}

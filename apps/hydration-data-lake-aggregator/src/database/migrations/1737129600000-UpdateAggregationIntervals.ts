import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateAggregationIntervals1737129600000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    /**
     * Update continuous aggregate intervals:
     * - fees_5hour (5 hours) → fees_6hour (6 hours)
     * - fees_1day (1 day) → fees_24hour (24 hours, refreshed every 6 hours)
     *
     * This migration will:
     * 1. Drop the old continuous aggregates (fees_5hour, fees_1day)
     * 2. Create new continuous aggregates with updated intervals
     * 3. Configure refresh policies to process all historical data
     */

    // ==========================================
    // Step 1: Drop old fees_5hour aggregate
    // ==========================================

    // Remove refresh policy
    await queryRunner.query(`
      SELECT remove_continuous_aggregate_policy('fees_5hour');
    `);

    // Drop materialized view
    await queryRunner.query(`
      DROP MATERIALIZED VIEW IF EXISTS fees_5hour CASCADE;
    `);

    // ==========================================
    // Step 2: Create new fees_6hour aggregate
    // ==========================================

    await queryRunner.query(`
      CREATE MATERIALIZED VIEW fees_6hour
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('6 hours', time) AS bucket,

        -- Total fees in USD (sum of all fees)
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

    // Add refresh policy (processes all historical data)
    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy('fees_6hour',
        start_offset => NULL,
        end_offset => INTERVAL '6 hours',
        schedule_interval => INTERVAL '6 hours');
    `);

    // Add retention policy
    await queryRunner.query(`
      SELECT add_retention_policy('fees_6hour', INTERVAL '180 days');
    `);

    // ==========================================
    // Step 3: Drop old fees_1day aggregate
    // ==========================================

    // Remove refresh policy
    await queryRunner.query(`
      SELECT remove_continuous_aggregate_policy('fees_1day');
    `);

    // Drop materialized view
    await queryRunner.query(`
      DROP MATERIALIZED VIEW IF EXISTS fees_1day CASCADE;
    `);

    // ==========================================
    // Step 4: Create new fees_24hour aggregate
    // ==========================================

    await queryRunner.query(`
      CREATE MATERIALIZED VIEW fees_24hour
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('24 hours', time) AS bucket,

        -- Total fees in USD (sum of all fees)
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

    // Add refresh policy (refreshes every 6 hours for more frequent updates)
    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy('fees_24hour',
        start_offset => NULL,
        end_offset => INTERVAL '24 hours',
        schedule_interval => INTERVAL '6 hours');
    `);

    // No retention policy - keep indefinitely

    /**
     * Note: Manual refresh is not performed here because it cannot run inside a transaction.
     * The automatic refresh policies will backfill historical data on their next scheduled run.
     * To manually trigger an immediate refresh after migration, run:
     *   CALL refresh_continuous_aggregate('fees_6hour', NULL, NULL);
     *   CALL refresh_continuous_aggregate('fees_24hour', NULL, NULL);
     * Or use: node scripts/refresh-aggregates.js
     */
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    /**
     * Rollback: Restore original fees_5hour and fees_1day aggregates
     */

    // ==========================================
    // Drop new aggregates
    // ==========================================

    // Remove refresh policies
    await queryRunner.query(`
      SELECT remove_continuous_aggregate_policy('fees_6hour');
    `);

    await queryRunner.query(`
      SELECT remove_continuous_aggregate_policy('fees_24hour');
    `);

    // Drop materialized views
    await queryRunner.query(`
      DROP MATERIALIZED VIEW IF EXISTS fees_6hour CASCADE;
    `);

    await queryRunner.query(`
      DROP MATERIALIZED VIEW IF EXISTS fees_24hour CASCADE;
    `);

    // ==========================================
    // Recreate original fees_5hour aggregate
    // ==========================================

    await queryRunner.query(`
      CREATE MATERIALIZED VIEW fees_5hour
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('5 hours', time) AS bucket,

        -- Total fees in USD (sum of all fees)
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

    // Restore original refresh policy
    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy('fees_5hour',
        start_offset => NULL,
        end_offset => INTERVAL '5 hours',
        schedule_interval => INTERVAL '5 hours');
    `);

    // Restore retention policy
    await queryRunner.query(`
      SELECT add_retention_policy('fees_5hour', INTERVAL '180 days');
    `);

    // ==========================================
    // Recreate original fees_1day aggregate
    // ==========================================

    await queryRunner.query(`
      CREATE MATERIALIZED VIEW fees_1day
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('1 day', time) AS bucket,

        -- Total fees in USD (sum of all fees)
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

    // Restore original refresh policy (12 hours)
    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy('fees_1day',
        start_offset => NULL,
        end_offset => INTERVAL '1 day',
        schedule_interval => INTERVAL '12 hours');
    `);

    // No retention policy for fees_1day
  }
}

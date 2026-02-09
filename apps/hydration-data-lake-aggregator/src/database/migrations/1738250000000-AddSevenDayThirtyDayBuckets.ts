import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

/**
 * Migration to add 7-day and 30-day continuous aggregates for all fee types
 *
 * Adds:
 * - fees_7day (Omnipool swap fees)
 * - fees_30day (Omnipool swap fees)
 * - liquidation_fees_7day (Money Market + Hollar fees)
 * - liquidation_fees_30day (Money Market + Hollar fees)
 * - hsm_revenue_7day (Hollar HSM revenue)
 * - hsm_revenue_30day (Hollar HSM revenue)
 */
export class AddSevenDayThirtyDayBuckets1738250000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // OMNIPOOL SWAP FEES - 7 DAY AND 30 DAY
    // ============================================================

    // fees_7day
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW fees_7day
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('7 days', s.time) AS bucket,

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

    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy('fees_7day',
        start_offset => INTERVAL '180 days',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 day');
    `);

    // await queryRunner.query(`
    //   SELECT add_retention_policy('fees_7day', INTERVAL '365 days');
    // `);

    // fees_30day
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW fees_30day
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('30 days', s.time) AS bucket,

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

    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy('fees_30day',
        start_offset => INTERVAL '365 days',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 day');
    `);

    // await queryRunner.query(`
    //   SELECT add_retention_policy('fees_30day', INTERVAL '730 days');
    // `);

    // ============================================================
    // MONEY MARKET LIQUIDATION FEES - 7 DAY AND 30 DAY
    // ============================================================

    // liquidation_fees_7day
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW liquidation_fees_7day
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('7 days', m.time) AS bucket,

        -- Total liquidation fees in USD (using embedded prices, respecting countInTotal flag)
        SUM(
          CASE
            WHEN COALESCE((fee_transfer->>'countInTotal')::boolean, true) = true
            THEN (fee_transfer->>'amount')::numeric *
                 COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0)
            ELSE 0
          END
        ) AS total_liquidation_fee_usd,

        -- Fees by type
        jsonb_build_object(
          'LIQUIDATION_PENALTY',
          COALESCE(SUM(
            CASE
              WHEN (fee_transfer->>'feeType') = 'LIQUIDATION_PENALTY'
              THEN (fee_transfer->>'amount')::numeric *
                   COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0)
              ELSE 0
            END
          ), 0),
          'PEPL_LIQUIDATION_PROFIT',
          COALESCE(SUM(
            CASE
              WHEN (fee_transfer->>'feeType') = 'PEPL_LIQUIDATION_PROFIT'
              THEN (fee_transfer->>'amount')::numeric *
                   COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0)
              ELSE 0
            END
          ), 0),
          'ASSET_RESERVE',
          COALESCE(SUM(
            CASE
              WHEN (fee_transfer->>'feeType') = 'ASSET_RESERVE'
              THEN (fee_transfer->>'amount')::numeric *
                   COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0)
              ELSE 0
            END
          ), 0),
          'BORROW_APR',
          COALESCE(SUM(
            CASE
              WHEN (fee_transfer->>'feeType') = 'BORROW_APR'
              THEN (fee_transfer->>'amount')::numeric *
                   COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0)
              ELSE 0
            END
          ), 0)
        ) AS fees_by_type,

        -- Liquidation count
        COUNT(DISTINCT m.liquidation_event_id) AS liquidation_count,

        -- Transfer count
        COUNT(fee_transfer) AS transfer_count

      FROM money_market_raw m
      CROSS JOIN LATERAL jsonb_array_elements(m.fee_by_transfer) AS fee_transfer
      WHERE jsonb_typeof(m.fee_spot_prices) = 'object'
        AND m.fee_spot_prices != '{}'::jsonb

      GROUP BY bucket
      WITH NO DATA;
    `);

    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy('liquidation_fees_7day',
        start_offset => INTERVAL '180 days',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 day');
    `);

    // await queryRunner.query(`
    //   SELECT add_retention_policy('liquidation_fees_7day', INTERVAL '365 days');
    // `);

    // liquidation_fees_30day
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW liquidation_fees_30day
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('30 days', m.time) AS bucket,

        -- Total liquidation fees in USD (using embedded prices, respecting countInTotal flag)
        SUM(
          CASE
            WHEN COALESCE((fee_transfer->>'countInTotal')::boolean, true) = true
            THEN (fee_transfer->>'amount')::numeric *
                 COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0)
            ELSE 0
          END
        ) AS total_liquidation_fee_usd,

        -- Fees by type
        jsonb_build_object(
          'LIQUIDATION_PENALTY',
          COALESCE(SUM(
            CASE
              WHEN (fee_transfer->>'feeType') = 'LIQUIDATION_PENALTY'
              THEN (fee_transfer->>'amount')::numeric *
                   COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0)
              ELSE 0
            END
          ), 0),
          'PEPL_LIQUIDATION_PROFIT',
          COALESCE(SUM(
            CASE
              WHEN (fee_transfer->>'feeType') = 'PEPL_LIQUIDATION_PROFIT'
              THEN (fee_transfer->>'amount')::numeric *
                   COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0)
              ELSE 0
            END
          ), 0),
          'ASSET_RESERVE',
          COALESCE(SUM(
            CASE
              WHEN (fee_transfer->>'feeType') = 'ASSET_RESERVE'
              THEN (fee_transfer->>'amount')::numeric *
                   COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0)
              ELSE 0
            END
          ), 0),
          'BORROW_APR',
          COALESCE(SUM(
            CASE
              WHEN (fee_transfer->>'feeType') = 'BORROW_APR'
              THEN (fee_transfer->>'amount')::numeric *
                   COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0)
              ELSE 0
            END
          ), 0)
        ) AS fees_by_type,

        -- Liquidation count
        COUNT(DISTINCT m.liquidation_event_id) AS liquidation_count,

        -- Transfer count
        COUNT(fee_transfer) AS transfer_count

      FROM money_market_raw m
      CROSS JOIN LATERAL jsonb_array_elements(m.fee_by_transfer) AS fee_transfer
      WHERE jsonb_typeof(m.fee_spot_prices) = 'object'
        AND m.fee_spot_prices != '{}'::jsonb

      GROUP BY bucket
      WITH NO DATA;
    `);

    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy('liquidation_fees_30day',
        start_offset => INTERVAL '365 days',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 day');
    `);

    // await queryRunner.query(`
    //   SELECT add_retention_policy('liquidation_fees_30day', INTERVAL '730 days');
    // `);

    // ============================================================
    // HSM REVENUE - 7 DAY AND 30 DAY
    // ============================================================

    // hsm_revenue_7day
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW hsm_revenue_7day
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('7 days', h.time) AS bucket,
        SUM(h.hsm_revenue) AS hsm_revenue,
        COUNT(*) AS event_count
      FROM hsm_revenue_raw h
      GROUP BY bucket
      WITH NO DATA;
    `);

    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy('hsm_revenue_7day',
        start_offset => INTERVAL '180 days',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 day');
    `);

    await queryRunner.query(`
      SELECT add_retention_policy('hsm_revenue_7day', INTERVAL '365 days');
    `);

    // hsm_revenue_30day
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW hsm_revenue_30day
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('30 days', h.time) AS bucket,
        SUM(h.hsm_revenue) AS hsm_revenue,
        COUNT(*) AS event_count
      FROM hsm_revenue_raw h
      GROUP BY bucket
      WITH NO DATA;
    `);

    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy('hsm_revenue_30day',
        start_offset => INTERVAL '365 days',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 day');
    `);

    await queryRunner.query(`
      SELECT add_retention_policy('hsm_revenue_30day', INTERVAL '730 days');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all created continuous aggregates
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS fees_7day CASCADE;`);
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS fees_30day CASCADE;`);
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS liquidation_fees_7day CASCADE;`);
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS liquidation_fees_30day CASCADE;`);
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS hsm_revenue_7day CASCADE;`);
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS hsm_revenue_30day CASCADE;`);
  }
}

/**
 * Script to update liquidation continuous aggregates to include BORROW_APR fees and countInTotal logic
 * Run with: node scripts/update-borrow-apr-aggregates.js
 *
 * This script:
 * 1. Drops existing liquidation_fees_* continuous aggregates
 * 2. Recreates them with BORROW_APR in fees_by_type and countInTotal logic
 * 3. Refreshes all aggregates to populate historical data
 */

const { Client } = require('pg');
require('dotenv').config();

const liquidationIntervals = [
  {
    name: 'liquidation_fees_1min',
    interval: '1 minute',
    refreshInterval: '1 minute',
    lag: '1 minute',
    startOffset: '10 minutes',
  },
  {
    name: 'liquidation_fees_5min',
    interval: '5 minutes',
    refreshInterval: '5 minutes',
    lag: '5 minutes',
    startOffset: '1 hour',
  },
  {
    name: 'liquidation_fees_10min',
    interval: '10 minutes',
    refreshInterval: '10 minutes',
    lag: '10 minutes',
    startOffset: '2 hours',
  },
  {
    name: 'liquidation_fees_30min',
    interval: '30 minutes',
    refreshInterval: '30 minutes',
    lag: '30 minutes',
    startOffset: '6 hours',
  },
  {
    name: 'liquidation_fees_1hour',
    interval: '1 hour',
    refreshInterval: '1 hour',
    lag: '1 hour',
    startOffset: '1 day',
  },
  {
    name: 'liquidation_fees_6hour',
    interval: '6 hours',
    refreshInterval: '6 hours',
    lag: '6 hours',
    startOffset: '3 days',
  },
  {
    name: 'liquidation_fees_24hour',
    interval: '1 day',
    refreshInterval: '1 day',
    lag: '1 day',
    startOffset: '7 days',
  },
];

async function updateLiquidationAggregates() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'hydration_charts',
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!\n');

    // Step 1: Drop existing continuous aggregates
    console.log('Step 1: Dropping existing liquidation continuous aggregates...');
    for (const config of liquidationIntervals) {
      console.log(`  Dropping ${config.name}...`);
      await client.query(
        `DROP MATERIALIZED VIEW IF EXISTS ${config.name} CASCADE;`
      );
    }
    console.log('✓ All existing aggregates dropped\n');

    // Step 2: Recreate continuous aggregates with BORROW_APR support and countInTotal logic
    console.log('Step 2: Creating updated continuous aggregates with BORROW_APR and countInTotal support...');
    for (const config of liquidationIntervals) {
      console.log(`  Creating ${config.name}...`);

      // Create continuous aggregate with BORROW_APR included and countInTotal logic
      await client.query(`
        CREATE MATERIALIZED VIEW ${config.name}
        WITH (timescaledb.continuous) AS
        SELECT
          time_bucket('${config.interval}', m.time) AS bucket,

          -- Total liquidation fees in USD (using embedded prices, respecting countInTotal flag)
          SUM(
            CASE
              WHEN COALESCE((fee_transfer->>'countInTotal')::boolean, true) = true
              THEN (fee_transfer->>'amount')::numeric *
                   COALESCE((m.fee_spot_prices->>(fee_transfer->>'assetId'))::numeric, 0)
              ELSE 0
            END
          ) AS total_liquidation_fee_usd,

          -- Fees by type (now includes BORROW_APR)
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
            ), 0),
            'OTHER',
            COALESCE(SUM(
              CASE
                WHEN (fee_transfer->>'feeType') = 'OTHER'
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

      // Add refresh policy
      await client.query(`
        SELECT add_continuous_aggregate_policy('${config.name}',
          start_offset => INTERVAL '${config.startOffset}',
          end_offset => INTERVAL '${config.lag}',
          schedule_interval => INTERVAL '${config.refreshInterval}');
      `);
    }
    console.log('✓ All aggregates recreated with BORROW_APR and countInTotal support\n');

    // Step 3: Refresh all aggregates to populate with historical data
    console.log('Step 3: Refreshing all aggregates to populate historical data...');
    for (const config of liquidationIntervals) {
      console.log(`  Refreshing ${config.name}...`);
      const startTime = Date.now();

      await client.query(
        `CALL refresh_continuous_aggregate($1, NULL, NULL)`,
        [config.name]
      );

      const duration = Date.now() - startTime;
      console.log(`  ✓ ${config.name} refreshed in ${duration}ms`);
    }
    console.log('\n✓ All continuous aggregates updated and refreshed successfully!');
    console.log('\nBorrow APR fees are now included in the fees_by_type breakdown.');
    console.log('Total calculations now respect the countInTotal flag to prevent double-counting.');

  } catch (error) {
    console.error('Error updating liquidation aggregates:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

updateLiquidationAggregates();

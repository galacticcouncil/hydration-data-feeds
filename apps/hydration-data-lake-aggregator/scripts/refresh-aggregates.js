/**
 * Script to manually refresh all continuous aggregates
 * Run with: node scripts/refresh-aggregates.js
 */

const { Client } = require('pg');
require('dotenv').config();

async function refreshAllAggregates() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'hydration_charts',
  });

  const aggregates = [
    // Omnipool swap fees
    'fees_1min',
    'fees_5min',
    'fees_10min',
    'fees_30min',
    'fees_1hour',
    'fees_6hour',
    'fees_24hour',
    'fees_7day',
    'fees_30day',
    // Money Market + Hollar liquidation fees
    'liquidation_fees_1min',
    'liquidation_fees_5min',
    'liquidation_fees_10min',
    'liquidation_fees_30min',
    'liquidation_fees_1hour',
    'liquidation_fees_6hour',
    'liquidation_fees_24hour',
    'liquidation_fees_7day',
    'liquidation_fees_30day',
    // Hollar HSM revenue
    'hsm_revenue_1min',
    'hsm_revenue_5min',
    'hsm_revenue_10min',
    'hsm_revenue_30min',
    'hsm_revenue_1hour',
    'hsm_revenue_6hour',
    'hsm_revenue_24hour',
    'hsm_revenue_7day',
    'hsm_revenue_30day',
    // Hollar Borrow APR
    'borrow_apr_1min',
    'borrow_apr_5min',
    'borrow_apr_10min',
    'borrow_apr_30min',
    'borrow_apr_1hour',
    'borrow_apr_6hour',
    'borrow_apr_24hour',
    'borrow_apr_7day',
    'borrow_apr_30day',
  ];

  // HSM revenue delta views must be populated after the base aggregates are refreshed
  const hsmDeltaViews = [
    ['hsm_revenue_1min', 'hsm_revenue_delta_1min'],
    ['hsm_revenue_5min', 'hsm_revenue_delta_5min'],
    ['hsm_revenue_10min', 'hsm_revenue_delta_10min'],
    ['hsm_revenue_30min', 'hsm_revenue_delta_30min'],
    ['hsm_revenue_1hour', 'hsm_revenue_delta_1hour'],
    ['hsm_revenue_6hour', 'hsm_revenue_delta_6hour'],
    ['hsm_revenue_24hour', 'hsm_revenue_delta_24hour'],
    ['hsm_revenue_7day', 'hsm_revenue_delta_7day'],
    ['hsm_revenue_30day', 'hsm_revenue_delta_30day'],
  ];

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!\n');

    console.log('--- Step 1: Refreshing continuous aggregates ---\n');
    for (const aggregate of aggregates) {
      console.log(`Refreshing ${aggregate}...`);
      const startTime = Date.now();

      await client.query(
        `CALL refresh_continuous_aggregate($1, NULL, NULL)`,
        [aggregate]
      );

      const duration = Date.now() - startTime;
      console.log(`✓ ${aggregate} refreshed in ${duration}ms\n`);
    }

    console.log('--- Step 2: Populating HSM revenue delta views ---\n');
    for (const [sourceView, deltaView] of hsmDeltaViews) {
      console.log(`Populating ${deltaView}...`);
      const startTime = Date.now();

      await client.query(
        `SELECT populate_hsm_revenue_delta_full($1, $2)`,
        [sourceView, deltaView]
      );

      const duration = Date.now() - startTime;
      console.log(`✓ ${deltaView} populated in ${duration}ms\n`);
    }

    console.log('All continuous aggregates refreshed successfully!');
  } catch (error) {
    console.error('Error refreshing aggregates:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

refreshAllAggregates();

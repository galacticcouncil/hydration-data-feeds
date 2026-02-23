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

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!\n');

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

    console.log('All continuous aggregates refreshed successfully!');
  } catch (error) {
    console.error('Error refreshing aggregates:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

refreshAllAggregates();

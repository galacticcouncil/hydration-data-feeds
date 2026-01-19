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
    'fees_1min',
    'fees_5min',
    'fees_10min',
    'fees_30min',
    'fees_1hour',
    'fees_6hour',
    'fees_24hour',
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

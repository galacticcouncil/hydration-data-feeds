-- Manually refresh all continuous aggregates to backfill historical data
-- Run this script after the RemoveTimeRestrictionsFromContinuousAggregates migration
-- to immediately populate aggregates with all historical enriched data

-- This script should be run outside of a transaction block
-- Execute with: psql -d your_database -f scripts/refresh-all-continuous-aggregates.sql

-- Step 1: Refresh all continuous aggregates

\echo 'Refreshing fees_1min...'
CALL refresh_continuous_aggregate('fees_1min', NULL, NULL);

\echo 'Refreshing fees_5min...'
CALL refresh_continuous_aggregate('fees_5min', NULL, NULL);

\echo 'Refreshing fees_10min...'
CALL refresh_continuous_aggregate('fees_10min', NULL, NULL);

\echo 'Refreshing fees_30min...'
CALL refresh_continuous_aggregate('fees_30min', NULL, NULL);

\echo 'Refreshing fees_1hour...'
CALL refresh_continuous_aggregate('fees_1hour', NULL, NULL);

\echo 'Refreshing fees_6hour...'
CALL refresh_continuous_aggregate('fees_6hour', NULL, NULL);

\echo 'Refreshing fees_24hour...'
CALL refresh_continuous_aggregate('fees_24hour', NULL, NULL);

\echo 'Refreshing fees_7day...'
CALL refresh_continuous_aggregate('fees_7day', NULL, NULL);

\echo 'Refreshing fees_30day...'
CALL refresh_continuous_aggregate('fees_30day', NULL, NULL);

\echo 'Refreshing liquidation_fees_1min...'
CALL refresh_continuous_aggregate('liquidation_fees_1min', NULL, NULL);

\echo 'Refreshing liquidation_fees_5min...'
CALL refresh_continuous_aggregate('liquidation_fees_5min', NULL, NULL);

\echo 'Refreshing liquidation_fees_10min...'
CALL refresh_continuous_aggregate('liquidation_fees_10min', NULL, NULL);

\echo 'Refreshing liquidation_fees_30min...'
CALL refresh_continuous_aggregate('liquidation_fees_30min', NULL, NULL);

\echo 'Refreshing liquidation_fees_1hour...'
CALL refresh_continuous_aggregate('liquidation_fees_1hour', NULL, NULL);

\echo 'Refreshing liquidation_fees_6hour...'
CALL refresh_continuous_aggregate('liquidation_fees_6hour', NULL, NULL);

\echo 'Refreshing liquidation_fees_24hour...'
CALL refresh_continuous_aggregate('liquidation_fees_24hour', NULL, NULL);

\echo 'Refreshing liquidation_fees_7day...'
CALL refresh_continuous_aggregate('liquidation_fees_7day', NULL, NULL);

\echo 'Refreshing liquidation_fees_30day...'
CALL refresh_continuous_aggregate('liquidation_fees_30day', NULL, NULL);

\echo 'Refreshing hsm_revenue_1min...'
CALL refresh_continuous_aggregate('hsm_revenue_1min', NULL, NULL);

\echo 'Refreshing hsm_revenue_5min...'
CALL refresh_continuous_aggregate('hsm_revenue_5min', NULL, NULL);

\echo 'Refreshing hsm_revenue_10min...'
CALL refresh_continuous_aggregate('hsm_revenue_10min', NULL, NULL);

\echo 'Refreshing hsm_revenue_30min...'
CALL refresh_continuous_aggregate('hsm_revenue_30min', NULL, NULL);

\echo 'Refreshing hsm_revenue_1hour...'
CALL refresh_continuous_aggregate('hsm_revenue_1hour', NULL, NULL);

\echo 'Refreshing hsm_revenue_6hour...'
CALL refresh_continuous_aggregate('hsm_revenue_6hour', NULL, NULL);

\echo 'Refreshing hsm_revenue_24hour...'
CALL refresh_continuous_aggregate('hsm_revenue_24hour', NULL, NULL);

\echo 'Refreshing hsm_revenue_7day...'
CALL refresh_continuous_aggregate('hsm_revenue_7day', NULL, NULL);

\echo 'Refreshing hsm_revenue_30day...'
CALL refresh_continuous_aggregate('hsm_revenue_30day', NULL, NULL);

\echo 'Refreshing borrow_apr_1min...'
CALL refresh_continuous_aggregate('borrow_apr_1min', NULL, NULL);

\echo 'Refreshing borrow_apr_5min...'
CALL refresh_continuous_aggregate('borrow_apr_5min', NULL, NULL);

\echo 'Refreshing borrow_apr_10min...'
CALL refresh_continuous_aggregate('borrow_apr_10min', NULL, NULL);

\echo 'Refreshing borrow_apr_30min...'
CALL refresh_continuous_aggregate('borrow_apr_30min', NULL, NULL);

\echo 'Refreshing borrow_apr_1hour...'
CALL refresh_continuous_aggregate('borrow_apr_1hour', NULL, NULL);

\echo 'Refreshing borrow_apr_6hour...'
CALL refresh_continuous_aggregate('borrow_apr_6hour', NULL, NULL);

\echo 'Refreshing borrow_apr_24hour...'
CALL refresh_continuous_aggregate('borrow_apr_24hour', NULL, NULL);

\echo 'Refreshing borrow_apr_7day...'
CALL refresh_continuous_aggregate('borrow_apr_7day', NULL, NULL);

\echo 'Refreshing borrow_apr_30day...'
CALL refresh_continuous_aggregate('borrow_apr_30day', NULL, NULL);

-- Step 2: Populate HSM revenue delta views (must run after base aggregates)

\echo 'Populating hsm_revenue_delta_1min...'
SELECT populate_hsm_revenue_delta_full('hsm_revenue_1min', 'hsm_revenue_delta_1min');

\echo 'Populating hsm_revenue_delta_5min...'
SELECT populate_hsm_revenue_delta_full('hsm_revenue_5min', 'hsm_revenue_delta_5min');

\echo 'Populating hsm_revenue_delta_10min...'
SELECT populate_hsm_revenue_delta_full('hsm_revenue_10min', 'hsm_revenue_delta_10min');

\echo 'Populating hsm_revenue_delta_30min...'
SELECT populate_hsm_revenue_delta_full('hsm_revenue_30min', 'hsm_revenue_delta_30min');

\echo 'Populating hsm_revenue_delta_1hour...'
SELECT populate_hsm_revenue_delta_full('hsm_revenue_1hour', 'hsm_revenue_delta_1hour');

\echo 'Populating hsm_revenue_delta_6hour...'
SELECT populate_hsm_revenue_delta_full('hsm_revenue_6hour', 'hsm_revenue_delta_6hour');

\echo 'Populating hsm_revenue_delta_24hour...'
SELECT populate_hsm_revenue_delta_full('hsm_revenue_24hour', 'hsm_revenue_delta_24hour');

\echo 'Populating hsm_revenue_delta_7day...'
SELECT populate_hsm_revenue_delta_full('hsm_revenue_7day', 'hsm_revenue_delta_7day');

\echo 'Populating hsm_revenue_delta_30day...'
SELECT populate_hsm_revenue_delta_full('hsm_revenue_30day', 'hsm_revenue_delta_30day');

\echo 'All continuous aggregates refreshed successfully!'

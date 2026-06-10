# Multi-Endpoint GraphQL Configuration

## Overview

This directory contains the configuration for the multi-endpoint GraphQL client system. The system automatically routes queries to different GraphQL endpoints based on block ranges, splits queries that span multiple endpoints, and merges the results.

## Configuration File: `endpoints.json`

The `endpoints.json` file defines all available GraphQL endpoints and their respective block ranges.

### File Location
```
src/graphql-client/config/endpoints.json
```

### Format

```json
[
  {
    "fromBlockHeight": 4000001,
    "toBlockHeight": 4500000,
    "apiUrl": "https://reaper-4000001-4500000-orca-p1.orca.hydration.cloud/graphql"
  },
  {
    "fromBlockHeight": 11000001,
    "toBlockHeight": -1,
    "apiUrl": "https://reaper-11000001-head-orca-p1.orca.hydration.cloud/graphql"
  }
]
```

### Field Definitions

- **`fromBlockHeight`** (number, required): The starting block height (inclusive) for this endpoint's data range
- **`toBlockHeight`** (number, required): The ending block height (inclusive) for this endpoint's data range
  - Use `-1` for the "head" endpoint that contains ongoing data to the current blockchain head
- **`apiUrl`** (string, required): The full GraphQL endpoint URL

### Configuration Rules

1. **No Overlapping Ranges**: Block ranges must not overlap between endpoints
2. **No Gaps Allowed**: The system will warn about gaps but won't fail (queries in gap ranges will error)
3. **Contiguous Ranges**: Each endpoint should start where the previous one ended (toBlock + 1)
4. **Single Head Endpoint**: Only one endpoint can have `toBlockHeight: -1`
5. **Head Endpoint Last**: The head endpoint should be the last one (highest `fromBlockHeight`)

### Example Configuration

Current production configuration includes 17 endpoints:
- 16 historical endpoints covering blocks 4,000,001 to 11,000,000
- 1 head endpoint covering blocks 11,000,001 to current blockchain head

## Environment Variables

### Required Variables

```bash
# Enable/disable multi-endpoint mode
GRAPHQL_MULTI_ENDPOINT_ENABLED=true

# Legacy fallback endpoint (used when multi-endpoint is disabled)
GRAPHQL_ENDPOINT=https://reaper-11000001-head-orca-p1.orca.hydration.cloud/graphql
```

### Optional Variable (Fallback)

```bash
# Optional: Override endpoints.json with JSON string
# Only used if endpoints.json file is not found
GRAPHQL_ENDPOINTS='[{"fromBlockHeight":4000001,"toBlockHeight":4500000,"apiUrl":"https://..."}]'
```

## How It Works

### 1. Configuration Loading Priority

1. **First**: Loads from `endpoints.json` file (recommended)
2. **Fallback**: Loads from `GRAPHQL_ENDPOINTS` environment variable

### 2. Startup Process

When the application starts:
1. Reads and parses the configuration
2. Validates all endpoint ranges (checks for overlaps, gaps, invalid ranges)
3. Creates a GraphQL client for each endpoint
4. Logs the configuration for verification

### 3. Query Routing

When a query is executed:
1. **Extract block range** from query variables
2. **Find matching endpoints** that cover the requested range
3. **Single endpoint**: Query directly
4. **Multiple endpoints**: Split query, execute in parallel, merge results

## Updating the Configuration

### Adding a New Endpoint

1. Open `endpoints.json`
2. Add the new endpoint entry maintaining proper order by `fromBlockHeight`
3. Ensure no overlaps with existing endpoints
4. Restart the application

```json
{
  "fromBlockHeight": 11000001,
  "toBlockHeight": 11500000,
  "apiUrl": "https://new-endpoint.hydration.cloud/graphql"
}
```

### Modifying an Endpoint

1. Update the endpoint entry in `endpoints.json`
2. Verify no overlaps or gaps are created
3. Restart the application

### Updating the Head Endpoint

The head endpoint (with `toBlockHeight: -1`) should always be updated to point to the latest data source:

```json
{
  "fromBlockHeight": 11000001,
  "toBlockHeight": -1,
  "apiUrl": "https://reaper-11000001-head-orca-p1.orca.hydration.cloud/graphql"
}
```

## Testing Configuration Changes

### 1. Validation on Startup

The system validates configuration on startup. Check logs for:
```
[EndpointConfig] Multi-endpoint mode enabled with 17 endpoints
[EndpointConfig] Endpoint 1: https://... (blocks 4000001-4500000)
[EndpointConfig] Endpoint 2: https://... (blocks 4500001-5000000)
...
```

### 2. Configuration Errors

If there are configuration errors, the application will fail to start with clear error messages:
- `Overlapping block ranges detected`
- `Invalid fromBlockHeight`
- `No endpoint configured for block range`

### 3. Testing Queries

Test queries spanning different scenarios:
```typescript
// Single endpoint (within one range)
query({ fromBlock: 4100000, toBlock: 4200000 })

// Multiple endpoints (spans two ranges)
query({ fromBlock: 4400000, toBlock: 4600000 })

// To head endpoint
query({ fromBlock: 11500000, toBlock: Number.MAX_SAFE_INTEGER })
```

## Monitoring

### Startup Logs
```
[EndpointConfig] Loaded endpoint configuration from endpoints.json file
[EndpointConfig] Multi-endpoint mode enabled with 17 endpoints
```

### Query Logs
```
[MultiEndpointGraphqlService] Splitting query across 2 endpoints for block range 4400000-4600000
[MultiEndpointGraphqlService] Successfully merged results from 2 endpoints
```

### Error Logs
```
[EndpointConfig] Failed to load endpoints from file: [error details]
[MultiEndpointGraphqlService] Query failed for endpoint https://... (blocks 4000001-4500000): Connection timeout
```

## Troubleshooting

### Issue: Application fails to start with "Overlapping block ranges"

**Solution**: Review `endpoints.json` and ensure no two endpoints have overlapping block ranges. Each range should be contiguous.

### Issue: Queries failing with "No endpoint configured for block range"

**Solution**: Check if the requested block range is covered by your endpoints. There might be a gap in coverage.

### Issue: "Failed to load endpoints from file"

**Solution**:
1. Verify `endpoints.json` exists in `src/graphql-client/config/`
2. Check file permissions
3. Validate JSON syntax
4. As a workaround, use the `GRAPHQL_ENDPOINTS` environment variable

### Issue: Slow query performance

**Possible causes**:
1. Query spans many endpoints (increase parallelization)
2. One endpoint is slower than others (bottleneck)
3. Large result sets during merge

**Solutions**:
1. Review query block ranges
2. Check individual endpoint health
3. Consider adjusting batch sizes

## Migration from Single Endpoint

### Before (Single Endpoint)
```bash
GRAPHQL_ENDPOINT=https://single-endpoint.com/graphql
GRAPHQL_MULTI_ENDPOINT_ENABLED=false
```

### After (Multi-Endpoint)
```bash
GRAPHQL_ENDPOINT=https://head-endpoint.com/graphql  # Fallback
GRAPHQL_MULTI_ENDPOINT_ENABLED=true
# Configuration loaded from endpoints.json
```

### Rollback Plan

To quickly disable multi-endpoint mode:
```bash
GRAPHQL_MULTI_ENDPOINT_ENABLED=false
```

The system will automatically fall back to the legacy single endpoint.

# Hydration Data Charts Aggregator - Setup Guide

## Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- Git

## Step-by-Step Setup

### 1. Create Environment File

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

The default values in `.env.example` are already configured to work with the Docker setup. You can use them as-is, or modify if needed:

```env
# Application
NODE_ENV=development
PORT=3000

# Database (TimescaleDB)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=hydration_charts

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# GraphQL Endpoint (Hydration Indexer)
GRAPHQL_ENDPOINT=https://squid.subsquid.io/hydration-main-indexer/graphql

# Ingestion Configuration
INGESTION_START_BLOCK=9999990
INGESTION_BATCH_SIZE=100
INGESTION_INTERVAL_SECONDS=60
INGESTION_BACKFILL_ON_STARTUP=true
```

### 2. Start Docker Services

Start TimescaleDB and Redis using Docker Compose:

```bash
docker-compose up -d
```

This will start:
- **TimescaleDB** (PostgreSQL with TimescaleDB extension) on port `5432`
- **Redis** (for state management and caching) on port `6379`
- **PgAdmin** (optional, for database management) on port `5050`

Verify services are running:

```bash
docker-compose ps
```

You should see:
```
NAME                              STATUS
hydration-charts-timescaledb      Up (healthy)
hydration-charts-redis            Up (healthy)
hydration-charts-pgadmin          Up
```

### 3. Run Database Migrations

Run the TypeORM migrations to create the database schema:

```bash
npm run migration:run
```

This will:
1. Create the `swaps_raw` hypertable with TimescaleDB
2. Create indexes for efficient queries
3. Create 18 continuous aggregates (6 combined + 6 asset fees + 6 protocol fees)
4. Set up automatic refresh policies for all aggregates
5. Configure data retention policies

Expected output:
```
query: CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
query: CREATE TABLE swaps_raw (...)
query: SELECT create_hypertable('swaps_raw', 'time');
query: CREATE MATERIALIZED VIEW swaps_1min ...
query: CREATE MATERIALIZED VIEW asset_fees_1min ...
query: CREATE MATERIALIZED VIEW protocol_fees_1min ...
...
Migration CreateInitialSchema1736584800000 has been executed successfully.
Migration CreateContinuousAggregates1736584900000 has been executed successfully.
Migration CreateRetentionPolicies1736585000000 has been executed successfully.
Migration CreateFeeTypeContinuousAggregates1736585100000 has been executed successfully.
```

### 4. Verify Database Setup

Connect to the database to verify the schema:

```bash
docker exec -it hydration-charts-timescaledb psql -U postgres -d hydration_charts
```

Check tables and views:
```sql
-- List tables
\dt

-- List materialized views
\dm

-- Verify hypertable
SELECT * FROM timescaledb_information.hypertables;

-- Check continuous aggregates
SELECT view_name, refresh_lag, refresh_interval
FROM timescaledb_information.continuous_aggregates;
```

Exit psql:
```
\q
```

### 5. Build the Application

Build the NestJS application:

```bash
npm run build
```

### 6. Start the Application

Start in development mode with hot-reload:

```bash
npm run start:dev
```

Or start in production mode:

```bash
npm run start:prod
```

### 7. Verify Application is Running

The application should start and begin ingestion:

```
[Nest] 12345  - 01/13/2025, 10:30:00 AM     LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 01/13/2025, 10:30:00 AM     LOG [InstanceLoader] ConfigModule dependencies initialized
[Nest] 12345  - 01/13/2025, 10:30:00 AM     LOG [InstanceLoader] DatabaseModule dependencies initialized
[Nest] 12345  - 01/13/2025, 10:30:00 AM     LOG [GraphqlClientService] GraphQL client initialized for https://squid.subsquid.io/hydration-main-indexer/graphql
[Nest] 12345  - 01/13/2025, 10:30:00 AM     LOG [IngestionOrchestratorService] Backfill on startup is enabled
[Nest] 12345  - 01/13/2025, 10:30:00 AM     LOG [NestApplication] Nest application successfully started
[Nest] 12345  - 01/13/2025, 10:30:00 AM     LOG [IngestionScheduler] Starting ingestion cycle
[Nest] 12345  - 01/13/2025, 10:30:01 AM     LOG [IngestionOrchestratorService] Starting ingestion: last=9999989, current=10500000
[Nest] 12345  - 01/13/2025, 10:30:01 AM     LOG [IngestionOrchestratorService] Processing batch: blocks 9999990 to 10000089
```

Check application health:

```bash
curl http://localhost:3000
```

### 8. Monitor Ingestion Progress

Check Redis state:

```bash
docker exec -it hydration-charts-redis redis-cli
```

```redis
GET ingestion:state:swaps
```

You should see the ingestion state as JSON:
```json
{
  "lastProcessedBlock": 10000089,
  "lastProcessedTimestamp": "2025-01-13T10:30:00.000Z",
  "lastIngestionAt": "2025-01-13T10:30:00.000Z",
  "status": "running"
}
```

## Useful Commands

### Docker Management

```bash
# View logs
docker-compose logs -f timescaledb
docker-compose logs -f redis

# Stop services
docker-compose down

# Stop and remove volumes (WARNING: deletes all data)
docker-compose down -v

# Restart services
docker-compose restart
```

### Database Management

```bash
# Show migration status
npm run migration:show

# Revert last migration
npm run migration:revert

# Access PgAdmin (optional)
# Open http://localhost:5050
# Email: admin@admin.com
# Password: admin
```

### Application Management

```bash
# Build
npm run build

# Start (production)
npm run start:prod

# Start (development with hot-reload)
npm run start:dev

# Start (debug mode)
npm run start:debug

# Check for TypeScript errors
npm run build

# Lint code
npm run lint
```

## Troubleshooting

### Database Connection Issues

If you get connection errors:

1. Check Docker services are running:
   ```bash
   docker-compose ps
   ```

2. Check database is accepting connections:
   ```bash
   docker exec -it hydration-charts-timescaledb pg_isready -U postgres
   ```

3. Verify .env file has correct DB credentials

### Redis Connection Issues

Check Redis is running:
```bash
docker exec -it hydration-charts-redis redis-cli ping
```

Expected response: `PONG`

### Ingestion Not Starting

Check logs for errors:
```bash
npm run start:dev
```

Common issues:
- GraphQL endpoint unreachable: Check `GRAPHQL_ENDPOINT` in .env
- Invalid start block: Verify `INGESTION_START_BLOCK` is a valid block number
- Redis state not initialized: Check Redis is running and accessible

### Migration Errors

If migrations fail:

1. Check database is running and accessible
2. Verify TimescaleDB extension is available:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'timescaledb';
   ```
3. If needed, manually install TimescaleDB:
   ```sql
   CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
   ```

## Architecture Overview

### Components

1. **Ingestion Pipeline**:
   - Fetches swap data from GraphQL endpoint
   - Calculates fees in USD using block-level asset prices
   - Classifies fees as "asset" or "protocol" based on recipient
   - Stores raw data in TimescaleDB hypertable

2. **State Management**:
   - Redis stores ingestion progress per service
   - Allows independent tracking for multiple data sources

3. **Data Aggregation**:
   - 18 continuous aggregates for time-series analysis
   - Automatic refresh on schedule
   - Pre-computed metrics for fast queries

4. **Fee Tracking**:
   - Total fees per swap
   - Asset fees vs Protocol fees breakdown
   - Individual fee distribution by recipient

### Data Flow

```
GraphQL API → Ingestion → Fee Calculation → Transformation → TimescaleDB
                ↓
              Redis (state tracking)
                ↓
         Continuous Aggregates (auto-refresh)
                ↓
           Chart APIs (future)
```


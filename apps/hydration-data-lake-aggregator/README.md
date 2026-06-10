# Hydration Data Charts Aggregator

A NestJS-based data ingestion and aggregation service for Hydration blockchain swap data. This service continuously ingests swap transactions from the Hydration blockchain via a GraphQL endpoint, processes and enriches them, and stores them in a TimescaleDB database for analytics and charting purposes.

## Description

This application is part of the Hydration data feeds infrastructure and provides:

- **Continuous Data Ingestion**: Fetches swap transaction data from the Hydration blockchain indexer
- **Data Processing**: Transforms and enriches raw swap data with calculated fees and prices
- **Persistent Storage**: Stores processed data in TimescaleDB (PostgreSQL time-series extension)
- **Caching Layer**: Redis-based caching for performance optimization
- **Health Monitoring**: Prometheus metrics and health check endpoints
- **State Management**: Tracks processing state to ensure no data loss during restarts

## Features

- **Automated Ingestion**: Scheduled tasks for continuous data fetching
- **Batch Processing**: Configurable batch sizes for efficient data processing
- **Backfill Support**: Ability to backfill historical data on startup
- **GraphQL Integration**: Connects to Hydration Subsquid indexer
- **API Versioning**: Support for multiple API versions via URL switching
- **TypeORM Migrations**: Database schema version control

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL with TimescaleDB extension
- Redis server
- Yarn package manager

## Installation

```bash
yarn install
```

## Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

### Environment Variables

Key configuration options:

**Application**
- `NODE_ENV`: Environment mode (development/production)
- `PORT`: API server port (default: 3000)

**Database (TimescaleDB)**
- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port
- `DB_USERNAME`: Database username
- `DB_PASSWORD`: Database password
- `DB_DATABASE`: Database name
- `DB_SYNCHRONIZE`: Auto-sync schema (disable in production)
- `DB_LOGGING`: Enable SQL query logging

**Redis**
- `REDIS_HOST`: Redis host
- `REDIS_PORT`: Redis port
- `REDIS_PASSWORD`: Redis password (optional)

**GraphQL Endpoint**
- `GRAPHQL_ENDPOINT`: Hydration indexer GraphQL endpoint

**Ingestion Configuration**
- `INGESTION_START_BLOCK`: Starting block number for ingestion
- `INGESTION_BATCH_SIZE`: Number of records to process per batch
- `INGESTION_INTERVAL_SECONDS`: Interval between ingestion runs
- `INGESTION_BACKFILL_ON_STARTUP`: Enable backfill on service startup

**Caching**
- `CACHE_TTL_1MIN`: 1-minute cache TTL in seconds
- `CACHE_TTL_1HOUR`: 1-hour cache TTL in seconds
- `CACHE_TTL_1DAY`: 1-day cache TTL in seconds

## Database Setup

Run database migrations:

```bash
# Run pending migrations
yarn migration:run

# Revert last migration
yarn migration:revert

# Show migration status
yarn migration:show
```

## Running the Application

```bash
# Development mode with auto-reload
yarn start:dev

# Production mode
yarn start:prod

# Debug mode
yarn start:debug
```

## Monitoring and Health Checks

The application exposes several endpoints for monitoring:

**Health Check**
- Endpoint: `/health`
- Provides database and Redis connectivity status

**Prometheus Metrics**
- Endpoint: `/metrics`
- Exposes application metrics for monitoring

## Testing

```bash
# Unit tests
yarn test

# E2E tests
yarn test:e2e

# Test coverage
yarn test:cov

# Watch mode
yarn test:watch
```

## Development

```bash
# Format code
yarn format

# Lint code
yarn lint

# Build application
yarn build
```

## Architecture

### Modules

- **ConfigModule**: Application configuration management
- **DatabaseModule**: TypeORM and TimescaleDB integration
- **GraphqlClientModule**: GraphQL client for Hydration indexer
- **IngestionModule**: Data ingestion and processing pipeline
- **EnrichmentModule**: Data enrichment and price calculation

### Key Services

- **IngestionOrchestratorService**: Orchestrates the data ingestion pipeline
- **GraphqlFetcherService**: Fetches swap data from the GraphQL endpoint
- **SwapTransformerService**: Transforms raw swap data into database entities
- **FeeCalculatorService**: Calculates transaction fees
- **PriceEnrichmentService**: Enriches data with price information
- **StateManagerService**: Manages ingestion state in Redis

## Project Structure

```
src/
├── config/           # Configuration files
├── database/         # Database entities and migrations
├── graphql-client/   # GraphQL client setup
├── ingestion/        # Data ingestion services
├── enrichment/       # Data enrichment services
├── common/           # Shared utilities and services
└── app.module.ts     # Root application module
```

## License

UNLICENSED

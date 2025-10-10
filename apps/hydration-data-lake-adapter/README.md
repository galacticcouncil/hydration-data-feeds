# Hydration Data Lake Adapter

A production-ready NestJS-based REST API adapter that implements the [DEX Screener Adapter specification](https://docs.dexscreener.com) for the Hydration Protocol. This application provides HTTP endpoints that enable DEX Screener to continuously index and track historical and real-time data from the Hydration decentralized exchange.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Development](#development)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview

The Hydration Data Lake Adapter serves as a bridge between DEX Screener's data ingestion infrastructure and the Hydration Protocol's blockchain data. It implements a standardized REST API specification that allows DEX Screener to efficiently query and index:

- **Trading pairs** and their metadata
- **Asset information** including symbols, decimals, and chain data
- **Swap events** from on-chain transactions
- **Liquidity events** (additions and removals)
- **Block information** for synchronization

### Key Features

- **🚀 Production-Ready**: Built with NestJS framework for scalability and maintainability
- **📊 DEX Screener Compliant**: Fully implements the DEX Screener Adapter API specification
- **🔌 GraphQL Integration**: Connects to Hydration's GraphQL APIs with retry logic and error handling
- **💾 Smart Caching**: Multi-layer caching strategy for optimal performance
- **🔒 Type Safety**: Complete TypeScript implementation with auto-generated GraphQL types
- **📖 API Documentation**: Interactive Swagger/OpenAPI documentation
- **⚙️ Configurable**: Environment-based configuration for different deployment scenarios
- **🛡️ Validation**: Request/response validation using class-validator
- **📡 Health Checks**: Built-in health check endpoints for monitoring
- **🔄 Auto-Retry**: Automatic retry logic for GraphQL queries with exponential backoff

### Use Cases

- **DEX Screener Integration**: Primary use case for DEX aggregation and analytics
- **Analytics Platforms**: Data source for DeFi analytics and tracking tools
- **Custom Integrations**: Foundation for building custom data consumers
- **Research**: Historical data access for blockchain research and analysis

## Architecture

### High-Level Architecture

```
┌─────────────────┐
│  DEX Screener   │
│   or Client     │
└────────┬────────┘
         │ HTTP/REST
         ▼
┌─────────────────────────────────────────┐
│   Hydration Data Lake Adapter (NestJS) │
│                                          │
│  ┌──────────────────────────────────┐  │
│  │    Controllers (API Endpoints)    │  │
│  └──────────────┬───────────────────┘  │
│                 │                        │
│  ┌──────────────▼───────────────────┐  │
│  │      Resolvers (Business Logic)   │  │
│  └──────────────┬───────────────────┘  │
│                 │                        │
│  ┌──────────────▼───────────────────┐  │
│  │   Transformers (Data Mapping)     │  │
│  └──────────────┬───────────────────┘  │
│                 │                        │
│  ┌──────────────▼───────────────────┐  │
│  │  Data Source Service (Aggregation)│  │
│  └──────────────┬───────────────────┘  │
│                 │                        │
│  ┌──────────────▼───────────────────┐  │
│  │   GraphQL Client (with Caching)   │  │
│  └──────────────┬───────────────────┘  │
└─────────────────┼───────────────────────┘
                  │ GraphQL
                  ▼
┌─────────────────────────────────────────┐
│   Hydration GraphQL Indexer APIs        │
│                                          │
│  - Main Indexer API (Blocks, Swaps)     │
│  - Historical Data API                   │
│  - Analytics API                         │
│  - Pairs/Assets API                      │
└──────────────────────────────────────────┘
```

### Core Modules

#### 1. **Consumers Module** (`src/modules/consumers`)
Implements different API consumer specifications (DEX Screener, custom consumers).
- **Base Controllers**: Shared controller logic and helpers
- **DEX Screener v1**: Complete DEX Screener API implementation
- **Transformers**: Convert internal data models to API response formats
- **Validators**: Request/response validation logic

#### 2. **Data Source Module** (`src/modules/dataSource`)
Handles data retrieval, aggregation, and enhancement.
- **GraphQL Support**: Query builders and type definitions for GraphQL APIs
- **Data Enhancement**: Asset metadata enrichment and validation
- **Caching Layer**: Multi-level caching for performance optimization

#### 3. **Configuration Module** (`src/modules/config`)
Centralized configuration management with validation.
- **App Config**: Application-level settings
- **GraphQL Config**: GraphQL endpoint configuration and management
- **Environment Validation**: Strict validation of environment variables

#### 4. **Providers Module** (`src/providers`)
Shared services and utilities.
- **GraphQL Client**: URQL-based GraphQL client with retry logic
- **Cache Providers**: Cache management for different data types
- **Base Helpers**: Shared utility functions

### Data Flow

1. **Request Reception**: Client sends HTTP request to API endpoint
2. **Validation**: Request parameters validated using DTOs and class-validator
3. **Resolution**: Resolver processes request and determines data requirements
4. **Cache Check**: Check if data exists in cache (hot path)
5. **Data Retrieval**: Query GraphQL APIs if cache miss (cold path)
6. **Data Enhancement**: Enrich data with metadata (e.g., asset info from static files)
7. **Transformation**: Transform internal models to API response format
8. **Cache Update**: Store results in cache for future requests
9. **Response**: Return formatted response to client

### Caching Strategy

The adapter implements a multi-layer caching strategy:

- **API Response Cache**: TTL-based caching of complete API responses
- **Entity Cache**: Long-lived cache for static/semi-static data (assets, pairs)
- **GraphQL Query Cache**: Cache GraphQL query results to reduce API calls
- **In-Memory Cache**: Fast access using Keyv with cache-manager

## Prerequisites

### Required

- **Node.js**: v18.0.0 or higher
- **npm**: v8.0.0 or higher
- **GraphQL API Access**: Valid Hydration GraphQL API endpoint(s) and credentials

### Recommended

- **Docker**: For containerized deployment (optional)
- **Git**: For version control
- **VSCode**: Recommended IDE with TypeScript support

### System Requirements

- **Memory**: Minimum 512MB RAM, recommended 1GB+
- **Storage**: ~500MB for dependencies
- **CPU**: Any modern CPU (multi-core recommended for production)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd hydration-data-feeds/apps/hydration-data-lake-adapter
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required dependencies including:
- NestJS framework and modules
- GraphQL client libraries (URQL)
- Caching libraries (cache-manager, keyv)
- Validation libraries (class-validator, class-transformer)
- Swagger/OpenAPI documentation tools

### 3. Environment Setup

Create your environment configuration file:

```bash
cp env.config.example .env
```

Edit `.env` with your specific configuration (see [Configuration](#configuration) section).

### 4. Generate GraphQL Types

Generate TypeScript types from the GraphQL schema:

```bash
npm run main-indexer-api-codegen
```

**Important**: Ensure `MAIN_INDEXER_GRAPHQL_ENDPOINT` is correctly set in your `.env` before running codegen.

### 5. Verify Installation

Start the application in development mode:

```bash
npm run start:dev
```

The application should start successfully on `http://localhost:3000` (or your configured port).

## Configuration

### Environment Variables

Create a `.env` file in the root directory. Below is a comprehensive guide to all available configuration options:

#### Application Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NODE_ENV` | `development \| production \| test` | `development` | Application environment mode |
| `PORT` | `number` | `3000` | HTTP server port |
| `BASE_PATH` | `string` | `/api/v1` | Global API prefix path |
| `HOST` | `string` | `localhost` | Server hostname |
| `SERVER_URL` | `string` | Auto-generated | Full server URL (overrides auto-detection) |
| `FORCE_HTTP` | `boolean` | `true` | Force HTTP protocol (disable HTTPS) |
| `DEX_KEY` | `string` | `hydration` | DEX identifier key |
| `DEFAULT_CHAIN_ID` | `number` | `1` | Default blockchain chain ID |

#### Feature Flags

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ENABLE_CORS` | `boolean` | `true` | Enable Cross-Origin Resource Sharing |
| `ENABLE_SWAGGER` | `boolean` | `true` | Enable Swagger/OpenAPI documentation UI |
| `ENABLE_METRICS` | `boolean` | `false` | Enable application metrics collection |
| `ENABLE_HEALTH_CHECK` | `boolean` | `true` | Enable health check endpoints |
| `ENABLE_TYPED_GRAPHQL` | `boolean` | `true` | Use generated TypeScript types for GraphQL |
| `ENABLE_DEBUG_LOGGING` | `boolean` | `false` | Enable verbose debug logging |

#### Performance & Caching

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `API_CACHE_TTL_MS` | `number` | `600000` (10min) | API response cache time-to-live in milliseconds |
| `ENTITIES_CACHE_TTL_MS` | `number` | `-1` (never) | Entity cache TTL (-1 = never expires) |
| `REQUEST_TIMEOUT_MS` | `number` | `30000` | HTTP request timeout in milliseconds |
| `MAX_BLOCK_RANGE` | `number` | `1000` | Maximum allowed block range per query (-1 = unlimited) |
| `MAX_BLOCKS_RANGE_FETCH_BATCH` | `number` | `300` | Maximum blocks to fetch in a single batch |
| `DEFAULT_PAGE_SIZE` | `number` | `100` | Default pagination page size |
| `MAX_PAGE_SIZE` | `number` | `1000` | Maximum pagination page size |

#### GraphQL Configuration

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `MAIN_INDEXER_GRAPHQL_ENDPOINT` | `string` | **Yes** | Primary GraphQL API endpoint URL |
| `GRAPHQL_API_KEY` | `string` | No | API key for GraphQL authentication (if required) |
| `GRAPHQL_REQUEST_TIMEOUT_MS` | `number` | `30000` | GraphQL request timeout in milliseconds |
| `GRAPHQL_MAX_RETRY_ATTEMPTS` | `number` | `3` | Maximum retry attempts for failed requests |
| `GRAPHQL_RETRY_DELAY_MS` | `number` | `1000` | Initial retry delay in milliseconds |
| `GRAPHQL_MAX_RETRY_DELAY_MS` | `number` | `15000` | Maximum retry delay (exponential backoff cap) |

#### Optional GraphQL Endpoints

These endpoints are optional and default to `MAIN_INDEXER_GRAPHQL_ENDPOINT` if not specified:

| Variable | Description |
|----------|-------------|
| `GRAPHQL_HISTORICAL_ENDPOINT` | Endpoint for historical data queries |
| `GRAPHQL_ANALYTICS_ENDPOINT` | Endpoint for analytics data |
| `GRAPHQL_PAIRS_ENDPOINT` | Endpoint for trading pair data |
| `GRAPHQL_ASSETS_ENDPOINT` | Endpoint for asset information |
| `GRAPHQL_EVENTS_ENDPOINT` | Endpoint for event data (swaps, liquidity) |

#### Logging

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `LOG_LEVEL` | `string` | `info` | Logging level (`error`, `warn`, `info`, `debug`, `verbose`) |

#### CORS Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `CORS_ORIGINS` | `string` (comma-separated) | `http://localhost:8080` | Allowed CORS origins |

#### Polkadot Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `HYDRADX_SS58_PREFIX` | `number` | `0` | SS58 address prefix for Hydration network |

#### Additional Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `IGNORE_INVALID_ENTITIES` | `boolean` | `true` | Skip invalid entities instead of throwing errors |

### Example Configuration

**Development Environment:**

```bash
NODE_ENV=development
PORT=3000
BASE_PATH=/api/v1
ENABLE_SWAGGER=true
ENABLE_DEBUG_LOGGING=true
API_CACHE_TTL_MS=60000  # 1 minute for faster development

MAIN_INDEXER_GRAPHQL_ENDPOINT=https://hydration-api.dev.example.com/graphql
GRAPHQL_API_KEY=dev_api_key_here
```

**Production Environment:**

```bash
NODE_ENV=production
PORT=8080
BASE_PATH=/api/v1
HOST=api.hydration.net
ENABLE_SWAGGER=false
ENABLE_DEBUG_LOGGING=false
API_CACHE_TTL_MS=600000  # 10 minutes
MAX_BLOCK_RANGE=1000
REQUEST_TIMEOUT_MS=30000

MAIN_INDEXER_GRAPHQL_ENDPOINT=https://hydration-api.prod.example.com/graphql
GRAPHQL_API_KEY=prod_api_key_here
GRAPHQL_MAX_RETRY_ATTEMPTS=5
```

## Development

### Running the Application

#### Development Mode (Hot Reload)

Start the application with automatic restart on file changes:

```bash
npm run start:dev
```

The server will start on `http://localhost:3000` (or your configured `PORT`).

#### Production Mode

Build and run the production version:

```bash
npm run build
npm run start
```

### Development Workflow

1. **Make code changes** in `src/` directory
2. **The app auto-reloads** (in dev mode) and reflects your changes
3. **View logs** in the console for debugging
4. **Test endpoints** via Swagger UI at `http://localhost:3000/api/v1/docs`
5. **Validate changes** by running API requests

### Code Generation

The project uses GraphQL Code Generator to create TypeScript types from GraphQL schemas.

#### Generate Types from GraphQL Schema

```bash
npm run main-indexer-api-codegen
```

This command:
- Connects to the GraphQL endpoint specified in `MAIN_INDEXER_GRAPHQL_ENDPOINT`
- Introspects the schema
- Generates TypeScript types in `src/modules/dataSource/graphqlSupport/mainIndexer/apiTypes.ts`
- Creates URQL introspection data for optimal caching

**Configuration**: See `codgenConfigs/main-indexer-api-types-condgen.config.ts`

**When to run:**
- After GraphQL schema changes on the server
- When setting up the project for the first time
- After updating GraphQL queries in the codebase

### Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| **Development** | `npm run start:dev` | Start in development mode with hot reload and debug logging |
| **Production** | `npm run start` | Start in production mode (requires build) |
| **Build** | `npm run build` | Compile TypeScript to JavaScript in `dist/` directory |
| **Code Generation** | `npm run main-indexer-api-codegen` | Generate TypeScript types from GraphQL schema |
| **Linting** | `npm run lint` | Run ESLint (configuration pending) |
| **Testing** | `npm run test` | Run test suite (configuration pending) |

### Adding New Endpoints

To add a new API endpoint:

1. **Create/Update DTO** in `src/modules/consumers/dexscreener/v1/dto/`
2. **Add resolver method** in `src/modules/consumers/dexscreener/v1/dexscreener.resolver.ts`
3. **Add controller endpoint** in `src/modules/consumers/dexscreener/v1/dexscreener.controller.ts`
4. **Add Swagger documentation** in `src/modules/consumers/dexscreener/v1/dexscreener.swagger.ts`
5. **Update transformer** if needed in `src/modules/consumers/dexscreener/v1/dexscreener.transformer.ts`
6. **Test the endpoint** via Swagger UI or cURL

### Adding New GraphQL Queries

To add a new GraphQL query:

1. **Define query** in `src/modules/dataSource/graphqlSupport/mainIndexer/queries/`
2. **Run codegen** to generate types: `npm run main-indexer-api-codegen`
3. **Use query** in `src/modules/dataSource/data-source.service.ts`
4. **Add caching** logic in appropriate cache provider

## API Documentation

### Swagger/OpenAPI Documentation

When `ENABLE_SWAGGER=true` in your environment configuration, comprehensive interactive API documentation is available.

**Access Swagger UI:**
```
http://localhost:3000/api/v1/docs
```

**Features:**
- 📖 **Interactive Testing**: Execute API calls directly from the browser
- 📋 **Complete Schema**: View all request/response models with examples
- 🔍 **Validation Rules**: See parameter constraints and requirements
- 📥 **Export Spec**: Download OpenAPI specification in JSON/YAML
- 💾 **Saved Credentials**: Persist authentication tokens across sessions

### API Endpoints

All endpoints are prefixed with `BASE_PATH` (default: `/api/v1`).

#### DEX Screener Endpoints

Base path: `/api/v1/dexscreener`

##### 1. Get Latest Block

```http
GET /api/v1/dexscreener/latest-block
```

Returns the latest indexed block number from the Hydration chain.

**Response:**
```json
{
  "block": 123456
}
```

**Use Case:** Synchronization and determining the current indexed state.

---

##### 2. Get Asset Information

```http
GET /api/v1/dexscreener/asset?id={assetId}
```

Retrieves detailed information about a specific asset.

**Parameters:**
- `id` (required): Asset ID (numeric string)

**Response:**
```json
{
  "id": "0",
  "name": "Hydration",
  "symbol": "HDX",
  "decimals": 12,
  "chainId": 1
}
```

**Use Case:** Asset metadata for trading pairs and displays.

---

##### 3. Get Trading Pair Information

```http
GET /api/v1/dexscreener/pair?id={pairId}
```

Retrieves detailed information about a trading pair.

**Parameters:**
- `id` (required): Pair ID (format: `{assetId0}-{assetId1}`)

**Response:**
```json
{
  "id": "0-5",
  "dexKey": "hydration",
  "asset0Id": "0",
  "asset1Id": "5",
  "asset0": {
    "id": "0",
    "symbol": "HDX",
    "decimals": 12
  },
  "asset1": {
    "id": "5",
    "symbol": "DOT",
    "decimals": 10
  },
  "createdAtBlockNumber": 1000
}
```

**Use Case:** Trading pair metadata and configuration.

---

##### 4. Get Events (Swaps & Liquidity)

```http
GET /api/v1/dexscreener/events?fromBlock={number}&toBlock={number}
```

Retrieves swap and liquidity events within a block range.

**Parameters:**
- `fromBlock` (required): Starting block number (inclusive)
- `toBlock` (required): Ending block number (inclusive)

**Constraints:**
- `fromBlock` ≤ `toBlock`
- Range ≤ `MAX_BLOCK_RANGE` (if configured)

**Response:**
```json
{
  "events": [
    {
      "type": "swap",
      "txnId": "0x123...",
      "txnIndex": 0,
      "eventIndex": 0,
      "maker": "7L53bUTBopuwFt3mKUfmkzgGLayYa1Yvn1hAg9v5UMrQzTfh",
      "pairId": "0-5",
      "asset0In": "1000000000000",
      "asset1Out": "950000000000",
      "priceNative": 1.05,
      "blockNumber": 123456,
      "timestamp": 1640000000
    },
    {
      "type": "addLiquidity",
      "txnId": "0x456...",
      "txnIndex": 1,
      "eventIndex": 0,
      "maker": "7L53bUTBopuwFt3mKUfmkzgGLayYa1Yvn1hAg9v5UMrQzTfh",
      "pairId": "0-5",
      "asset0Amount": "5000000000000",
      "asset1Amount": "4750000000000",
      "blockNumber": 123456,
      "timestamp": 1640000100
    }
  ]
}
```

**Use Case:** Historical event tracking, analytics, and charting.

---

##### 5. Health Check

```http
GET /api/v1/dexscreener/health
```

Returns the health status of the DEX Screener adapter.

**Response:**
```json
{
  "consumer": "dexscreener",
  "version": "v1",
  "status": "OK",
  "endpoints": ["latest-block", "asset", "pair", "events"]
}
```

**Use Case:** Service monitoring and uptime checks.

---

#### Meta Endpoints

##### Get API Information

```http
GET /api/info
```

Returns general information about the API.

**Response:**
```json
{
  "name": "Hydration Data Lake Adapter",
  "version": "1.0.0",
  "description": "DEX Screener Adapter for Hydration Protocol",
  "environment": "development"
}
```

---

##### List All Consumers

```http
GET /api/consumers
```

Lists all available API consumers and their versions.

**Response:**
```json
{
  "consumers": [
    {
      "type": "dexscreener",
      "version": "v1",
      "basePath": "/api/v1/dexscreener"
    }
  ]
}
```

### Testing API Endpoints

#### Using cURL

**Get latest block:**
```bash
curl http://localhost:3000/api/v1/dexscreener/latest-block
```

**Get asset by ID:**
```bash
curl "http://localhost:3000/api/v1/dexscreener/asset?id=0"
```

**Get pair by ID:**
```bash
curl "http://localhost:3000/api/v1/dexscreener/pair?id=0-5"
```

**Get events in block range:**
```bash
curl "http://localhost:3000/api/v1/dexscreener/events?fromBlock=100000&toBlock=100100"
```

**Health check:**
```bash
curl http://localhost:3000/api/v1/dexscreener/health
```

#### Using HTTPie

```bash
http GET localhost:3000/api/v1/dexscreener/latest-block
http GET localhost:3000/api/v1/dexscreener/asset id==0
http GET localhost:3000/api/v1/dexscreener/pair id=="0-5"
http GET localhost:3000/api/v1/dexscreener/events fromBlock==100000 toBlock==100100
```

#### Using Swagger UI

1. Navigate to `http://localhost:3000/api/v1/docs`
2. Expand the endpoint you want to test
3. Click "Try it out"
4. Fill in the required parameters
5. Click "Execute"
6. View the response below

## Project Structure

```
hydration-data-lake-adapter/
├── src/                                  # Source code directory
│   ├── main.ts                           # Application entry point
│   ├── app.module.ts                     # Root application module
│   │
│   ├── modules/                          # Feature modules
│   │   ├── config/                       # Configuration management
│   │   │   ├── app.config.ts             # Application configuration
│   │   │   ├── graphql.config.ts         # GraphQL configuration
│   │   │   ├── config.module.ts          # Configuration module
│   │   │   └── types.ts                  # Configuration types
│   │   │
│   │   ├── consumers/                    # API consumers (DEX Screener, etc.)
│   │   │   ├── base/                     # Base consumer logic
│   │   │   │   ├── base.controller.ts    # Base controller class
│   │   │   │   └── base.helper.ts        # Shared utilities
│   │   │   │
│   │   │   ├── dexscreener/              # DEX Screener implementation
│   │   │   │   └── v1/                   # Version 1 API
│   │   │   │       ├── dexscreener.controller.ts   # API endpoints
│   │   │   │       ├── dexscreener.resolver.ts     # Business logic
│   │   │   │       ├── dexscreener.transformer.ts  # Data transformation
│   │   │   │       ├── dexscreener.validator.ts    # Custom validators
│   │   │   │       ├── dexscreener.swagger.ts      # Swagger decorators
│   │   │   │       └── dto/              # Data transfer objects
│   │   │   │           ├── api.dto.ts    # API request/response DTOs
│   │   │   │           └── entities.dto.ts # Entity DTOs
│   │   │   │
│   │   │   ├── consumer-info.controller.ts  # Consumer info endpoint
│   │   │   ├── consumers.module.ts       # Consumers module
│   │   │   └── types.ts                  # Consumer types
│   │   │
│   │   ├── dataSource/                   # Data retrieval and processing
│   │   │   ├── data-source.service.ts    # Main data source service
│   │   │   ├── data-source.module.ts     # Data source module
│   │   │   │
│   │   │   ├── graphqlSupport/           # GraphQL query support
│   │   │   │   ├── mainIndexer/          # Main indexer queries
│   │   │   │   │   ├── queries/          # GraphQL query definitions
│   │   │   │   │   │   ├── asset.ts      # Asset queries
│   │   │   │   │   │   ├── block.ts      # Block queries
│   │   │   │   │   │   ├── pool.ts       # Pool/pair queries
│   │   │   │   │   │   ├── swap.ts       # Swap event queries
│   │   │   │   │   │   └── stableswap-liquidity-event.ts
│   │   │   │   │   └── apiTypes.ts       # Generated GraphQL types
│   │   │   │   └── types.ts              # GraphQL support types
│   │   │   │
│   │   │   ├── dataEnhancement/          # Data enhancement logic
│   │   │   │   └── assets/               # Asset metadata enhancement
│   │   │   │       ├── asset-enhancement.service.ts
│   │   │   │       ├── assets.json       # Static asset metadata
│   │   │   │       └── types.ts
│   │   │   │
│   │   │   └── types.ts                  # Data source types
│   │   │
│   │   └── entities/                     # Domain entities
│   │
│   ├── providers/                        # Shared providers/services
│   │   ├── graphql-client.provider.ts    # GraphQL client setup
│   │   ├── providers.module.ts           # Providers module
│   │   │
│   │   └── cache/                        # Caching providers
│   │       ├── base-cache.helper.ts      # Base cache utilities
│   │       ├── dexscreener-cache.provider.ts
│   │       └── main-indexer-cache.provider.ts
│   │
│   ├── dto/                              # Shared DTOs
│   ├── interfaces/                       # Shared interfaces
│   └── utils/                            # Utility functions
│       └── validators.ts                 # Custom validators
│
├── codgenConfigs/                        # GraphQL code generator configs
│   └── main-indexer-api-types-condgen.config.ts
│
├── dist/                                 # Compiled JavaScript (build output)
├── node_modules/                         # Dependencies
│
├── .env                                  # Environment variables (create from example)
├── env.config.example                    # Example environment configuration
├── package.json                          # NPM dependencies and scripts
├── tsconfig.json                         # TypeScript configuration
├── nest-cli.json                         # NestJS CLI configuration
└── README.md                             # This file
```

### Key Directories Explained

- **`src/modules/consumers/`**: Each consumer (e.g., DEX Screener) has its own directory with controllers, resolvers, transformers, and DTOs
- **`src/modules/dataSource/`**: Centralized data retrieval from GraphQL APIs with caching and enhancement
- **`src/modules/config/`**: Configuration management with validation
- **`src/providers/`**: Shared services like GraphQL client and caching
- **`codgenConfigs/`**: GraphQL Code Generator configuration for type generation

## Testing

### Manual Testing

Use the Swagger UI for interactive testing:
```
http://localhost:3000/api/v1/docs
```

### Automated Testing

**Note**: Test suite configuration is pending.

Once configured, tests will be run with:

```bash
npm run test         # Run all tests
npm run test:watch   # Watch mode
npm run test:cov     # Coverage report
npm run test:e2e     # End-to-end tests
```

### Integration Testing

Test against a live GraphQL endpoint:

1. Configure `.env` with a test GraphQL endpoint
2. Start the application: `npm run start:dev`
3. Run test requests via Swagger UI or cURL
4. Verify responses match expected format

### Load Testing

For performance testing, consider using tools like:
- **Apache Bench (ab)**: Simple HTTP benchmarking
- **k6**: Modern load testing tool
- **Artillery**: Advanced load testing

Example with Apache Bench:
```bash
ab -n 1000 -c 10 http://localhost:3000/api/v1/dexscreener/latest-block
```

## Deployment

### Production Build

1. **Install dependencies**:
   ```bash
   npm ci  # Use npm ci for reproducible builds
   ```

2. **Build the application**:
   ```bash
   npm run build
   ```

3. **Set production environment variables**:
   ```bash
   export NODE_ENV=production
   # Set other required env vars or use .env file
   ```

4. **Start the application**:
   ```bash
   npm run start
   ```

### Docker Deployment (Coming Soon)

A Dockerfile and docker-compose configuration will be added for containerized deployment.

### Environment-Specific Configuration

**Production Checklist:**
- ✅ Set `NODE_ENV=production`
- ✅ Disable Swagger in production (`ENABLE_SWAGGER=false`)
- ✅ Configure appropriate cache TTLs
- ✅ Set production GraphQL endpoints
- ✅ Enable CORS only for allowed origins
- ✅ Configure appropriate logging level
- ✅ Set up monitoring and health checks
- ✅ Use process manager (PM2, systemd)
- ✅ Configure reverse proxy (nginx, Apache)
- ✅ Enable HTTPS/SSL

### Process Management

#### Using PM2

```bash
npm install -g pm2

# Start application
pm2 start dist/main.js --name hydration-adapter

# Monitor
pm2 monit

# View logs
pm2 logs hydration-adapter

# Restart
pm2 restart hydration-adapter
```

#### Using systemd

Create a systemd service file:

```ini
[Unit]
Description=Hydration Data Lake Adapter
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/hydration-data-lake-adapter
ExecStart=/usr/bin/node dist/main.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Monitoring

**Health Check Endpoint:**
```bash
curl http://localhost:3000/api/v1/dexscreener/health
```

**Logging:**
- Application logs are output to stdout/stderr
- Use a log aggregation service (e.g., CloudWatch, Datadog)
- Configure `LOG_LEVEL` appropriately

**Metrics** (if `ENABLE_METRICS=true`):
- Metrics endpoint: `/metrics` (Prometheus-compatible format, coming soon)

### Scaling

For high-traffic deployments:

1. **Horizontal Scaling**: Run multiple instances behind a load balancer
2. **Caching**: Increase `API_CACHE_TTL_MS` to reduce GraphQL API calls
3. **Connection Pooling**: Configure GraphQL client for connection reuse
4. **CDN**: Use a CDN for static responses (if applicable)

## Troubleshooting

### Common Issues

#### 1. Application Won't Start

**Error**: `Failed to validate environment variables`

**Solution**:
- Verify `.env` file exists and is properly formatted
- Check all required environment variables are set
- Validate GraphQL endpoint URLs are correct
- Review application logs for specific validation errors

**Error**: `Cannot find module`

**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
```

#### 2. GraphQL Connection Issues

**Error**: `GraphQL request failed` or `Network error`

**Solution**:
- Verify `MAIN_INDEXER_GRAPHQL_ENDPOINT` is accessible
- Check API key (if required): `GRAPHQL_API_KEY`
- Test endpoint connectivity:
  ```bash
  curl -X POST https://your-endpoint/graphql \
    -H "Content-Type: application/json" \
    -d '{"query": "{ __schema { queryType { name } } }"}'
  ```
- Review retry configuration: `GRAPHQL_MAX_RETRY_ATTEMPTS`

#### 3. Type Generation Fails

**Error**: `GraphQL codegen failed`

**Solution**:
- Ensure GraphQL endpoint is running and accessible
- Verify endpoint URL in `.env` is correct
- Check GraphQL schema hasn't changed incompatibly
- Review `codgenConfigs/main-indexer-api-types-condgen.config.ts`

#### 4. Swagger UI Not Loading

**Error**: `Cannot GET /docs`

**Solution**:
- Verify `ENABLE_SWAGGER=true` in `.env`
- Check the correct path: `http://localhost:3000/api/v1/docs`
- Review `BASE_PATH` configuration

#### 5. CORS Errors

**Error**: `Access-Control-Allow-Origin` error in browser

**Solution**:
- Set `ENABLE_CORS=true`
- Add origin to `CORS_ORIGINS`: `CORS_ORIGINS=http://localhost:3000,https://example.com`
- Restart the application after config changes

#### 6. Performance Issues

**Symptoms**: Slow response times, high latency

**Solutions**:
- Increase cache TTL: `API_CACHE_TTL_MS=1200000` (20 minutes)
- Reduce `MAX_BLOCK_RANGE` for events queries
- Decrease `MAX_BLOCKS_RANGE_FETCH_BATCH`
- Enable GraphQL query batching
- Monitor GraphQL API response times
- Check system resources (CPU, memory)

### Debugging

#### Enable Debug Logging

```bash
ENABLE_DEBUG_LOGGING=true
LOG_LEVEL=debug
```

Restart the application and check logs for detailed information.

#### Inspect GraphQL Queries

To see raw GraphQL queries being sent:
1. Set `ENABLE_DEBUG_LOGGING=true`
2. Check application logs for GraphQL query details

#### Common Error Codes

| Status Code | Meaning | Possible Cause |
|-------------|---------|----------------|
| 400 | Bad Request | Invalid query parameters (check `fromBlock`, `toBlock`, `id`) |
| 404 | Not Found | Asset or pair does not exist |
| 408 | Request Timeout | GraphQL API timeout (increase `REQUEST_TIMEOUT_MS`) |
| 429 | Too Many Requests | Rate limiting (implement request throttling) |
| 500 | Internal Server Error | Application error (check logs) |
| 502 | Bad Gateway | GraphQL API connection issue |
| 503 | Service Unavailable | Application overloaded or GraphQL API down |

### Getting Help

If you encounter issues not covered here:

1. **Check application logs** for detailed error messages
2. **Review environment configuration** for correctness
3. **Test GraphQL endpoint** independently
4. **Create an issue** in the project repository with:
   - Error message and stack trace
   - Environment configuration (sanitize secrets)
   - Steps to reproduce
   - Application version

## Contributing

We welcome contributions! Please follow these guidelines:

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests (when available): `npm run test`
5. Commit your changes: `git commit -m "feat: add new feature"`
6. Push to your fork: `git push origin feature/my-feature`
7. Create a Pull Request

### Code Style

- Follow TypeScript and NestJS best practices
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused
- Write clean, readable code

### Commit Messages

Follow conventional commits format:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

### Pull Request Process

1. Update documentation if needed
2. Ensure all tests pass
3. Update CHANGELOG if applicable
4. Request review from maintainers
5. Address review feedback

## License

UNLICENSED - Proprietary software for Hydration Protocol

## Resources

- **Hydration Protocol**: https://hydration.net
- **DEX Screener Docs**: https://docs.dexscreener.com
- **NestJS Documentation**: https://docs.nestjs.com
- **GraphQL**: https://graphql.org

## Support

For support and questions:
- **Email**: support@hydration.net
- **Documentation**: [Project Wiki](#)
- **Issues**: [GitHub Issues](#)

---

**Version**: 1.0.0
**Last Updated**: 2025-10-10
**Maintained by**: Hydration Team
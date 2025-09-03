# Hydration Data Lake Adapter

A NestJS-based REST API adapter that implements the DEX Screener Adapter specification for the Hydration Protocol. This application provides HTTP endpoints that allow DEX Screener to track historical and real-time data from the Hydration decentralized exchange.

## Overview

The DEX Screener Adapter is a set of HTTP endpoints that enables DEX Screener to continuously index events from the Hydration Protocol. The adapter is responsible for supplying accurate and up-to-date data, while DEX Screener handles all data ingestion, processing, and serving.

### Key Features

- **REST API Endpoints**: Implements the complete DEX Screener specification including `/latest-block`, `/asset`, `/pair`, and `/events`
- **GraphQL Integration**: Connects to Hydration's GraphQL APIs for data retrieval
- **Type Safety**: Full TypeScript implementation with generated GraphQL types
- **OpenAPI/Swagger Documentation**: Interactive API documentation with request/response examples
- **Configurable**: Environment-based configuration for different deployment scenarios
- **Scalable**: Built on NestJS framework with modular architecture

### API Endpoints

The adapter implements the following DEX Screener endpoints:

- `GET /api/v1/dexscreener/latest-block` - Returns the latest indexed block
- `GET /api/v1/dexscreener/asset?id=:string` - Retrieves asset information by ID
- `GET /api/v1/dexscreener/pair?id=:string` - Retrieves trading pair information by ID
- `GET /api/v1/dexscreener/events?fromBlock=:number&toBlock=:number` - Retrieves swap and liquidity events for a block range
- `GET /api/v1/dexscreener/health` - Health check endpoint

## Prerequisites

- **Node.js**: v18 or higher
- **npm**: v8 or higher
- **GraphQL API Access**: Valid endpoint and API key for Hydration's GraphQL API

## Installation

1. **Clone the repository** (if not already done):
   ```bash
   git clone <repository-url>
   cd hydration-data-feeds/apps/hydration-data-lake-adapter
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment configuration**:
   ```bash
   cp env.config.example .env
   ```
   
## Development

### Running the Application Locally

1. **Development mode** (with hot reload):
   ```bash
   npm run start:dev
   ```

2. **Production mode**:
   ```bash
   npm run build
   npm run start
   ```

The application will start on `http://localhost:8080` (or the port specified in your `.env` file).

### Code Generation

The project uses GraphQL Code Generator to create TypeScript types from GraphQL schemas.

1. **Generate types from main GraphQL API**:
   ```bash
   npm run main-indexer-api-codegen
   ```

**Note**: Make sure your `.env` file has the correct `MAIN_INDEXER_GRAPHQL_ENDPOINT` configured before running codegen.

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Start in development mode with hot reload |
| `npm run start` | Start in production mode |
| `npm run build` | Build the application for production |
| `npm run main-indexer-api-codegen` | Generate TypeScript types from GraphQL schema |
| `npm run lint` | Run linting (not configured yet) |
| `npm run test` | Run tests (not configured yet) |

## Configuration

See `env.config.example` file, [AppConfig](./src/modules/config/app.config.ts) and [GraphQLConfig](./src/modules/config/graphql.config.ts) services for the complete list of available configuration options.

## API Documentation

### Swagger/OpenAPI Documentation

The application includes comprehensive API documentation powered by Swagger/OpenAPI. When `ENABLE_SWAGGER=true` in your environment configuration, you can access:

**Swagger UI**: `http://localhost:8080/docs`

Features include:
- **Interactive Interface**: Test API endpoints directly from the browser
- **Complete Schema Documentation**: View request/response models with examples
- **Authentication Support**: Test authenticated endpoints (if applicable)
- **OpenAPI Specification**: Download the complete API specification in JSON/YAML format
- **Real-time Validation**: See validation rules and error responses

### Testing the API

Once the application is running, you can:

1. **Test the health endpoint**:
   ```bash
   curl http://localhost:3000/api/v1/dexscreener/health
   ```

2. **Check the latest block**:
   ```bash
   curl http://localhost:3000/api/v1/dexscreener/latest-block
   ```

3. **Get API information**:
   ```bash
   curl http://localhost:3000/api/info
   ```

4. **List all consumers**:
   ```bash
   curl http://localhost:3000/api/consumers
   ```

## Deployment

### Building for Production

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Start in production mode**:
   ```bash
   npm run start
   ```

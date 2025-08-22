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

4. **Configure environment variables** in `.env`:
   ```bash
   # Required - Update these values
   MAIN_INDEXER_GRAPHQL_ENDPOINT=https://your-hydration-api.com/graphql
   GRAPHQL_API_KEY=your_actual_api_key_here
   
   # Optional - Customize as needed
   PORT=3000
   BASE_PATH=/api/v1
   DEX_KEY=hydration
   ENABLE_CORS=true
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

The application will start on `http://localhost:3000` (or the port specified in your `.env` file).

### Code Generation

The project uses GraphQL Code Generator to create TypeScript types from GraphQL schemas.

1. **Generate types from main GraphQL API**:
   ```bash
   npm run main-indexer-api-codegen
   ```

2. **Alternative codegen command** (if `codegen.yml` exists):
   ```bash
   npm run codegen
   ```

**Note**: Make sure your `.env` file has the correct `MAIN_INDEXER_GRAPHQL_ENDPOINT` configured before running codegen.

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Start in development mode with hot reload |
| `npm run start` | Start in production mode |
| `npm run build` | Build the application for production |
| `npm run main-indexer-api-codegen` | Generate TypeScript types from GraphQL schema |
| `npm run codegen` | Alternative codegen command |
| `npm run lint` | Run linting (not configured yet) |
| `npm run test` | Run tests (not configured yet) |

## Project Structure

```
src/
├── app.module.ts                    # Main application module
├── main.ts                         # Application entry point
├── dto/                            # Data Transfer Objects
├── interfaces/                     # TypeScript interfaces
├── modules/
│   ├── config/                     # Configuration management
│   ├── consumers/                  # API consumer implementations
│   │   ├── base/                   # Base consumer classes
│   │   ├── dexscreener/v1/         # DEX Screener v1 implementation
│   │   └── consumer-info.controller.ts
│   └── dataSource/                 # GraphQL data source
│       ├── generated/              # Generated GraphQL types
│       ├── graphqlSupport/         # GraphQL utilities and queries
│       └── queries/                # GraphQL query definitions
└── providers/                      # Application providers
```

## Configuration

### Environment Variables

The application uses the following key environment variables:

#### Core Configuration
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 3000)
- `BASE_PATH`: API base path (default: /api/v1)
- `DEX_KEY`: DEX identifier (default: hydration)

#### GraphQL Configuration
- `MAIN_INDEXER_GRAPHQL_ENDPOINT`: Primary GraphQL endpoint URL
- `GRAPHQL_API_KEY`: API key for authentication
- `GRAPHQL_REQUEST_TIMEOUT_MS`: Request timeout (default: 30000)
- `GRAPHQL_MAX_RETRY_ATTEMPTS`: Max retry attempts (default: 3)

#### Feature Flags
- `ENABLE_CORS`: Enable CORS (default: true)
- `ENABLE_SWAGGER`: Enable Swagger documentation (default: true)
- `ENABLE_TYPED_GRAPHQL`: Enable typed GraphQL queries (default: true)

#### Performance Settings
- `API_CACHE_TTL_MS`: API cache TTL (default: 600000)
- `MAX_BLOCK_RANGE`: Maximum block range per request (default: 1000)
- `DEFAULT_PAGE_SIZE`: Default pagination size (default: 100)

See `env.config.example` for the complete list of available configuration options.

## API Documentation

### Swagger/OpenAPI Documentation

The application includes comprehensive API documentation powered by Swagger/OpenAPI. When `ENABLE_SWAGGER=true` in your environment configuration, you can access:

**Swagger UI**: `http://localhost:3000/api/v1/docs`

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

### Docker Deployment

The application can be containerized using Docker. Make sure to:

1. Include your `.env` file or set environment variables
2. Expose the configured port
3. Ensure network access to the GraphQL API endpoints

## Troubleshooting

### Common Issues

1. **GraphQL Connection Errors**:
   - Verify `MAIN_INDEXER_GRAPHQL_ENDPOINT` is correct
   - Check if `GRAPHQL_API_KEY` is valid
   - Ensure network connectivity to the GraphQL endpoint

2. **Code Generation Fails**:
   - Make sure the GraphQL endpoint is accessible
   - Verify the schema is valid
   - Check if the endpoint requires authentication

3. **Port Already in Use**:
   - Change the `PORT` in your `.env` file
   - Or kill the process using the port: `lsof -ti:3000 | xargs kill -9`

### Logs

The application provides detailed logging. Check the console output for:
- Configuration summary on startup
- API request logs
- Error details and stack traces

## Contributing

1. Follow the existing code structure and patterns
2. Update TypeScript types when modifying GraphQL queries
3. Ensure proper error handling and logging
4. Test endpoints thoroughly before submitting changes

## License

This project is licensed under UNLICENSED - see the LICENSE file for details.

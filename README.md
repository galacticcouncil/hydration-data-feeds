# Hydration Data Feeds

A TypeScript monorepo containing applications that ingest, aggregate, and serve decorated data feeds from the [Hydration Protocol](https://hydration.net) for third-party consumers such as DEX aggregators and analytics platforms.

## Project Structure

This monorepo uses [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces) and [Turbo](https://turbo.build) for efficient builds and development workflows. Each application lives under `apps/*`, is built with [NestJS](https://nestjs.com), and is written in TypeScript.

### Applications

| App | Version | Description |
| --- | --- | --- |
| [hydration-data-lake-adapter](./apps/hydration-data-lake-adapter) | 1.0.0 | REST API adapter implementing the DEX Screener Adapter specification for Hydration |
| [hydration-data-lake-aggregator](./apps/hydration-data-lake-aggregator) | 0.0.1 | Data ingestion & aggregation service that processes Hydration on-chain data into a TimescaleDB time-series store |

## Applications Overview

### Hydration Data Lake Adapter

A production-ready NestJS REST API that implements the [DEX Screener Adapter specification](https://docs.dexscreener.com) for the Hydration Protocol. It acts as a read-only bridge that lets DEX Screener (and other clients) continuously index and track historical and real-time data from the Hydration decentralized exchange.

- **Source data**: queries Hydration's GraphQL indexer APIs via a URQL client with retry/back-off logic.
- **Exposes**: standardized DEX Screener endpoints for trading pairs, assets, swap events, liquidity events, and block information.
- **Highlights**: multi-layer caching, request/response validation, interactive Swagger/OpenAPI docs, Prometheus metrics, and health-check endpoints.
- **Tooling**: GraphQL Code Generator produces typed queries from the indexer schema.

See [`apps/hydration-data-lake-adapter/README.md`](./apps/hydration-data-lake-adapter/README.md) and [`MONITORING.md`](./apps/hydration-data-lake-adapter/MONITORING.md) for full details.

### Hydration Data Lake Aggregator

A NestJS ingestion and aggregation service that continuously pulls Hydration on-chain data from the Subsquid GraphQL indexer, enriches it, and persists it to a TimescaleDB (PostgreSQL time-series) database for analytics and charting. Redis provides a caching/state layer, and scheduled tasks drive continuous ingestion.

Functional modules:

- **Ingestion** — fetches and transforms swap transactions, calculating fees.
- **Money Market** — aggregates asset reserves, liquidations, and PEPL profit.
- **Hollar** — computes borrow APR and HSM revenue metrics.
- **Charts** — serves fee chart and aggregate data (`GET /api/v1/fees/charts`, `GET /api/v1/fees/aggregate`).
- **Dataset** — serves prepared datasets (`GET /api/v1/dataset`).

Additional capabilities include TypeORM migrations for schema versioning, Prometheus metrics, health-check endpoints, and configurable backfill on startup.

See [`apps/hydration-data-lake-aggregator/README.md`](./apps/hydration-data-lake-aggregator/README.md) and [`SETUP.md`](./apps/hydration-data-lake-aggregator/SETUP.md) for full details.

## Prerequisites

- **Node.js**: v20 or higher
- **npm**: v10 or higher (the repo pins `npm@10.2.4`)
- For the aggregator: **PostgreSQL with the TimescaleDB extension** and a **Redis** server (a local stack is provided via `apps/hydration-data-lake-aggregator/docker-compose.yml`)

Each app reads its own environment configuration; copy the provided example file (`.env.example` / `env.config.example`) inside the app directory and adjust the values before running. Refer to the individual app READMEs for the full list of environment variables and run scripts.

## License

See [LICENSE](./LICENSE).

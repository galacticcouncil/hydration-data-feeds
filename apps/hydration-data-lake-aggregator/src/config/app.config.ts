import * as Joi from 'joi';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  nearHeadBlocks: number;
  graphql: {
    endpoint: string;
    multiEndpoint: {
      enabled: boolean;
      endpoints: string;
    };
    enforcedEndpoints: {
      hsmBalances: string | null;
    };
  };
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    synchronize: boolean;
    logging: boolean;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  ingestion: {
    startBlock: number;
    batchSize: number;
    intervalSeconds: number;
    backfillOnStartup: boolean;
    omnipoolRuntimeUpgradeBlock: number;
  };
  moneyMarket: {
    startBlock: number;
    batchSize: number;
    intervalSeconds: number;
    backfillOnStartup: boolean;
  };
  peplLiquidation: {
    startBlock: number;
    batchSize: number;
    intervalSeconds: number;
    backfillOnStartup: boolean;
  };
  assetReserve: {
    startBlock: number;
    batchSize: number;
    intervalSeconds: number;
    backfillOnStartup: boolean;
  };
  hsmRevenue: {
    startBlock: number;
    batchSize: number;
    intervalSeconds: number;
    backfillOnStartup: boolean;
  };
  borrowApr: {
    startBlock: number;
    batchSize: number;
    intervalSeconds: number;
    backfillOnStartup: boolean;
  };
  assetRegistry: {
    refreshIntervalSeconds: number;
  };
  price: {
    spotPriceBaseAssetId: string;
  };
  cache: {
    ttl1Min: number;
    ttl1Hour: number;
    ttl1Day: number;
  };
  api: {
    port: number;
    public: boolean;
    timezone: string;
  };
  dataset: {
    id: string;
    version: string;
    network: string;
  };
  indexer: {
    id: string;
    version: string;
    network: string;
  };
}

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

  // This ID must be the same as in data source indexer
  ASSET_PRICE_BASE_ASSET_ID: Joi.string().default('10'),

  // GraphQL
  GRAPHQL_ENDPOINT: Joi.string().uri().required(),
  GRAPHQL_MULTI_ENDPOINT_ENABLED: Joi.boolean().default(false),
  GRAPHQL_ENDPOINTS: Joi.string().optional().default('[]'),
  ENFORCED_GRAPHQL_ENDPOINT_HSM_BALANCES: Joi.string().uri().optional(),

  // Database
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(true),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional().allow(''),

  // Near-head CAGG refresh threshold (~5 min at 6s/block, ~10 min at 12s/block)
  NEAR_HEAD_BLOCKS: Joi.number().default(50),

  // Ingestion
  INGESTION_START_BLOCK: Joi.number().required(),
  INGESTION_BATCH_SIZE: Joi.number().default(100),
  INGESTION_INTERVAL_SECONDS: Joi.number().default(60),
  INGESTION_BACKFILL_ON_STARTUP: Joi.boolean().default(true),
  OMNIPOOL_RUNTIME_UPGRADE_BLOCK: Joi.number().default(11394694),

  // Money Market
  MONEY_MARKET_START_BLOCK: Joi.number().default(121),
  MONEY_MARKET_BATCH_SIZE: Joi.number().default(100),
  MONEY_MARKET_INTERVAL_SECONDS: Joi.number().default(60),
  MONEY_MARKET_BACKFILL_ON_STARTUP: Joi.boolean().default(true),

  // PEPL Liquidation
  PEPL_LIQUIDATION_START_BLOCK: Joi.number().default(1000000),
  PEPL_LIQUIDATION_BATCH_SIZE: Joi.number().default(500),
  PEPL_LIQUIDATION_INTERVAL_SECONDS: Joi.number().default(300), // 5 minutes
  PEPL_LIQUIDATION_BACKFILL_ON_STARTUP: Joi.boolean().default(true),

  // Asset Reserve
  ASSET_RESERVE_START_BLOCK: Joi.number().default(1000000),
  ASSET_RESERVE_BATCH_SIZE: Joi.number().default(500),
  ASSET_RESERVE_INTERVAL_SECONDS: Joi.number().default(300), // 5 minutes
  ASSET_RESERVE_BACKFILL_ON_STARTUP: Joi.boolean().default(true),

  // HSM Revenue
  HSM_REVENUE_START_BLOCK: Joi.number().default(1000000),
  HSM_REVENUE_BATCH_SIZE: Joi.number().default(100),
  HSM_REVENUE_INTERVAL_SECONDS: Joi.number().default(300), // 5 minutes
  HSM_REVENUE_BACKFILL_ON_STARTUP: Joi.boolean().default(true),

  // Borrow APR
  BORROW_APR_START_BLOCK: Joi.number().default(1000000),
  BORROW_APR_BATCH_SIZE: Joi.number().default(100),
  BORROW_APR_INTERVAL_SECONDS: Joi.number().default(300), // 5 minutes
  BORROW_APR_BACKFILL_ON_STARTUP: Joi.boolean().default(true),

  // Asset Registry
  ASSET_REGISTRY_REFRESH_INTERVAL: Joi.number().default(43200), // 12 hours

  // Caching
  CACHE_TTL_1MIN: Joi.number().default(60),
  CACHE_TTL_1HOUR: Joi.number().default(300),
  CACHE_TTL_1DAY: Joi.number().default(600),

  // API
  API_PORT: Joi.number().default(3000),
  API_PUBLIC: Joi.boolean().default(true),
  API_TIMEZONE: Joi.string().default('UTC'),

  // Dataset metadata
  DATASET_ID: Joi.string().default('fees-aggregates-mainnet'),
  DATASET_VERSION: Joi.string().default('2026.01.29-01'),
  DATASET_NETWORK: Joi.string().default('hydration'),
  INDEXER_ID: Joi.string().default('orca-multipool-mainnet'),
  INDEXER_VERSION: Joi.string().default('2026.01.29-01'),
  INDEXER_NETWORK: Joi.string().default('hydration'),
});

export const getAppConfig = (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV!,
  port: parseInt(process.env.PORT!, 10),
  nearHeadBlocks: parseInt(process.env.NEAR_HEAD_BLOCKS!, 10),
  price: {
    spotPriceBaseAssetId: process.env.ASSET_PRICE_BASE_ASSET_ID!,
  },
  graphql: {
    endpoint: process.env.GRAPHQL_ENDPOINT!,
    multiEndpoint: {
      enabled: process.env.GRAPHQL_MULTI_ENDPOINT_ENABLED === 'true',
      endpoints: process.env.GRAPHQL_ENDPOINTS!,
    },
    enforcedEndpoints: {
      hsmBalances: process.env.ENFORCED_GRAPHQL_ENDPOINT_HSM_BALANCES || null,
    },
  },
  database: {
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT!, 10),
    username: process.env.DB_USERNAME!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_DATABASE!,
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },
  redis: {
    host: process.env.REDIS_HOST!,
    port: parseInt(process.env.REDIS_PORT!, 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  ingestion: {
    startBlock: parseInt(process.env.INGESTION_START_BLOCK!, 10),
    batchSize: parseInt(process.env.INGESTION_BATCH_SIZE!, 10),
    intervalSeconds: parseInt(process.env.INGESTION_INTERVAL_SECONDS!, 10),
    backfillOnStartup: process.env.INGESTION_BACKFILL_ON_STARTUP !== 'false',
    omnipoolRuntimeUpgradeBlock: parseInt(process.env.OMNIPOOL_RUNTIME_UPGRADE_BLOCK!, 10),
  },
  moneyMarket: {
    startBlock: parseInt(process.env.MONEY_MARKET_START_BLOCK!, 10),
    batchSize: parseInt(process.env.MONEY_MARKET_BATCH_SIZE!, 10),
    intervalSeconds: parseInt(process.env.MONEY_MARKET_INTERVAL_SECONDS!, 10),
    backfillOnStartup: process.env.MONEY_MARKET_BACKFILL_ON_STARTUP !== 'false',
  },
  peplLiquidation: {
    startBlock: parseInt(process.env.PEPL_LIQUIDATION_START_BLOCK!, 10),
    batchSize: parseInt(process.env.PEPL_LIQUIDATION_BATCH_SIZE!, 10),
    intervalSeconds: parseInt(process.env.PEPL_LIQUIDATION_INTERVAL_SECONDS!, 10),
    backfillOnStartup: process.env.PEPL_LIQUIDATION_BACKFILL_ON_STARTUP !== 'false',
  },
  assetReserve: {
    startBlock: parseInt(process.env.ASSET_RESERVE_START_BLOCK!, 10),
    batchSize: parseInt(process.env.ASSET_RESERVE_BATCH_SIZE!, 10),
    intervalSeconds: parseInt(process.env.ASSET_RESERVE_INTERVAL_SECONDS!, 10),
    backfillOnStartup: process.env.ASSET_RESERVE_BACKFILL_ON_STARTUP !== 'false',
  },
  hsmRevenue: {
    startBlock: parseInt(process.env.HSM_REVENUE_START_BLOCK!, 10),
    batchSize: parseInt(process.env.HSM_REVENUE_BATCH_SIZE!, 10),
    intervalSeconds: parseInt(process.env.HSM_REVENUE_INTERVAL_SECONDS!, 10),
    backfillOnStartup: process.env.HSM_REVENUE_BACKFILL_ON_STARTUP !== 'false',
  },
  borrowApr: {
    startBlock: parseInt(process.env.BORROW_APR_START_BLOCK!, 10),
    batchSize: parseInt(process.env.BORROW_APR_BATCH_SIZE!, 10),
    intervalSeconds: parseInt(process.env.BORROW_APR_INTERVAL_SECONDS!, 10),
    backfillOnStartup: process.env.BORROW_APR_BACKFILL_ON_STARTUP !== 'false',
  },
  assetRegistry: {
    refreshIntervalSeconds: parseInt(process.env.ASSET_REGISTRY_REFRESH_INTERVAL!, 10),
  },
  cache: {
    ttl1Min: parseInt(process.env.CACHE_TTL_1MIN!, 10),
    ttl1Hour: parseInt(process.env.CACHE_TTL_1HOUR!, 10),
    ttl1Day: parseInt(process.env.CACHE_TTL_1DAY!, 10),
  },
  api: {
    port: parseInt(process.env.API_PORT!, 10),
    public: process.env.API_PUBLIC !== 'false',
    timezone: process.env.API_TIMEZONE!,
  },
  dataset: {
    id: process.env.DATASET_ID!,
    version: process.env.DATASET_VERSION!,
    network: process.env.DATASET_NETWORK!,
  },
  indexer: {
    id: process.env.INDEXER_ID!,
    version: process.env.INDEXER_VERSION!,
    network: process.env.INDEXER_NETWORK!,
  },
});

import * as Joi from 'joi';

export interface AppConfig {
  nodeEnv: string;
  port: number;
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
  enrichment: {
    batchSize: number;
    intervalSeconds: number;
    maxRetries: number;
  };
  assetRegistry: {
    refreshIntervalSeconds: number;
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
}

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

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

  // Ingestion
  INGESTION_START_BLOCK: Joi.number().required(),
  INGESTION_BATCH_SIZE: Joi.number().default(100),
  INGESTION_INTERVAL_SECONDS: Joi.number().default(60),
  INGESTION_BACKFILL_ON_STARTUP: Joi.boolean().default(true),

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

  // Enrichment
  ENRICHMENT_BATCH_SIZE: Joi.number().default(1000),
  ENRICHMENT_INTERVAL_SECONDS: Joi.number().default(120),
  ENRICHMENT_MAX_RETRIES: Joi.number().default(3),

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
});

export const getAppConfig = (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  graphql: {
    endpoint: process.env.GRAPHQL_ENDPOINT || '',
    multiEndpoint: {
      enabled: process.env.GRAPHQL_MULTI_ENDPOINT_ENABLED === 'true',
      endpoints: process.env.GRAPHQL_ENDPOINTS || '[]',
    },
    enforcedEndpoints: {
      hsmBalances: process.env.ENFORCED_GRAPHQL_ENDPOINT_HSM_BALANCES || null,
    },
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || '',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  ingestion: {
    startBlock: parseInt(process.env.INGESTION_START_BLOCK || '9999990', 10),
    batchSize: parseInt(process.env.INGESTION_BATCH_SIZE || '100', 10),
    intervalSeconds: parseInt(
      process.env.INGESTION_INTERVAL_SECONDS || '60',
      10,
    ),
    backfillOnStartup: process.env.INGESTION_BACKFILL_ON_STARTUP !== 'false',
  },
  moneyMarket: {
    startBlock: parseInt(process.env.MONEY_MARKET_START_BLOCK || '121', 10),
    batchSize: parseInt(process.env.MONEY_MARKET_BATCH_SIZE || '100', 10),
    intervalSeconds: parseInt(
      process.env.MONEY_MARKET_INTERVAL_SECONDS || '60',
      10,
    ),
    backfillOnStartup: process.env.MONEY_MARKET_BACKFILL_ON_STARTUP !== 'false',
  },
  peplLiquidation: {
    startBlock: parseInt(
      process.env.PEPL_LIQUIDATION_START_BLOCK || '1000000',
      10,
    ),
    batchSize: parseInt(process.env.PEPL_LIQUIDATION_BATCH_SIZE || '500', 10),
    intervalSeconds: parseInt(
      process.env.PEPL_LIQUIDATION_INTERVAL_SECONDS || '300',
      10,
    ),
    backfillOnStartup:
      process.env.PEPL_LIQUIDATION_BACKFILL_ON_STARTUP !== 'false',
  },
  assetReserve: {
    startBlock: parseInt(
      process.env.ASSET_RESERVE_START_BLOCK || '1000000',
      10,
    ),
    batchSize: parseInt(process.env.ASSET_RESERVE_BATCH_SIZE || '500', 10),
    intervalSeconds: parseInt(
      process.env.ASSET_RESERVE_INTERVAL_SECONDS || '300',
      10,
    ),
    backfillOnStartup:
      process.env.ASSET_RESERVE_BACKFILL_ON_STARTUP !== 'false',
  },
  hsmRevenue: {
    startBlock: parseInt(process.env.HSM_REVENUE_START_BLOCK || '1000000', 10),
    batchSize: parseInt(process.env.HSM_REVENUE_BATCH_SIZE || '100', 10),
    intervalSeconds: parseInt(
      process.env.HSM_REVENUE_INTERVAL_SECONDS || '300',
      10,
    ),
    backfillOnStartup: process.env.HSM_REVENUE_BACKFILL_ON_STARTUP !== 'false',
  },
  enrichment: {
    batchSize: parseInt(process.env.ENRICHMENT_BATCH_SIZE || '1000', 10),
    intervalSeconds: parseInt(
      process.env.ENRICHMENT_INTERVAL_SECONDS || '120',
      10,
    ),
    maxRetries: parseInt(process.env.ENRICHMENT_MAX_RETRIES || '3', 10),
  },
  assetRegistry: {
    refreshIntervalSeconds: parseInt(
      process.env.ASSET_REGISTRY_REFRESH_INTERVAL || '43200',
      10,
    ),
  },
  cache: {
    ttl1Min: parseInt(process.env.CACHE_TTL_1MIN || '60', 10),
    ttl1Hour: parseInt(process.env.CACHE_TTL_1HOUR || '300', 10),
    ttl1Day: parseInt(process.env.CACHE_TTL_1DAY || '600', 10),
  },
  api: {
    port: parseInt(process.env.API_PORT || '3000', 10),
    public: process.env.API_PUBLIC !== 'false',
    timezone: process.env.API_TIMEZONE || 'UTC',
  },
});

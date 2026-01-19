import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppConfig } from './app.config';

export const getDatabaseConfig = (
  configService: ConfigService<AppConfig>,
): TypeOrmModuleOptions => {
  const dbConfig = configService.get('database', { infer: true });

  if (!dbConfig) {
    throw new Error('Database configuration is missing');
  }

  return {
    type: 'postgres',
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    synchronize: dbConfig.synchronize,
    logging: dbConfig.logging,
    // Enable TimescaleDB support
    extra: {
      max: 20, // Maximum number of clients in the pool
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    },
  };
};

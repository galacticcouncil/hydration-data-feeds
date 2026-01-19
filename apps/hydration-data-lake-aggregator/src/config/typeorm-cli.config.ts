import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file
config({ path: resolve(__dirname, '../../.env') });

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'hydration_charts',
  entities: [resolve(__dirname, '../database/entities/**/*.entity{.ts,.js}')],
  migrations: [resolve(__dirname, '../database/migrations/**/*{.ts,.js}')],
  synchronize: false,
  logging: true,
});

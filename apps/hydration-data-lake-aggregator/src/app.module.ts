import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChartsModule } from './charts/charts.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { GraphqlClientModule } from './graphql-client/graphql-client.module';
import { HollarModule } from './hollar/hollar.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { MoneyMarketModule } from './money-market/money-market.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    GraphqlClientModule,
    IngestionModule,
    MoneyMarketModule,
    HollarModule,
    ChartsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

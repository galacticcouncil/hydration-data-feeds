import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChartsModule } from './charts/charts.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { DatasetModule } from './dataset/dataset.module';
import { GraphqlClientModule } from './graphql-client/graphql-client.module';
import { HollarModule } from './hollar/hollar.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { MoneyMarketModule } from './money-market/money-market.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    GraphqlClientModule,
    ScheduleModule.forRoot(),
    IngestionModule,
    MoneyMarketModule,
    HollarModule,
    ChartsModule,
    DatasetModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

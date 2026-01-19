import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { GraphqlClientModule } from './graphql-client/graphql-client.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { EnrichmentModule } from './enrichment/enrichment.module';
import { ChartsModule } from './charts/charts.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    GraphqlClientModule,
    IngestionModule,
    EnrichmentModule,
    ChartsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

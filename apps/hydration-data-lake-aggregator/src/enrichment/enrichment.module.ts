import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SwapRaw } from '../database/entities';
import { GraphqlClientModule } from '../graphql-client/graphql-client.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { CommonModule } from '../common/common.module';
import { PriceEnrichmentService } from './services/price-enrichment.service';
import { PriceEnrichmentScheduler } from './schedulers/price-enrichment.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([SwapRaw]),
    ScheduleModule.forRoot(),
    GraphqlClientModule,
    IngestionModule,
    CommonModule,
  ],
  providers: [PriceEnrichmentService, PriceEnrichmentScheduler],
  exports: [PriceEnrichmentService],
})
export class EnrichmentModule {}

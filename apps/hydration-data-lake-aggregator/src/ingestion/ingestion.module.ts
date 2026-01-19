import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SwapRaw } from '../database/entities';
import { GraphqlClientModule } from '../graphql-client/graphql-client.module';
import { CommonModule } from '../common/common.module';
import { GraphqlFetcherService } from './services/graphql-fetcher.service';
import { FeeCalculatorService } from './services/fee-calculator.service';
import { SwapTransformerService } from './services/swap-transformer.service';
import { IngestionOrchestratorService } from './services/ingestion-orchestrator.service';
import { IngestionScheduler } from './schedulers/ingestion.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([SwapRaw]),
    ScheduleModule.forRoot(),
    GraphqlClientModule,
    CommonModule,
  ],
  providers: [
    GraphqlFetcherService,
    FeeCalculatorService,
    SwapTransformerService,
    IngestionOrchestratorService,
    IngestionScheduler,
  ],
  exports: [
    IngestionOrchestratorService,
    GraphqlFetcherService,
    FeeCalculatorService,
    SwapTransformerService,
  ],
})
export class IngestionModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SwapRaw } from '../database/entities';
import { GraphqlClientModule } from '../graphql-client/graphql-client.module';
import { CommonModule } from '../common/common.module';
import { DatabaseModule } from '../database/database.module';
import { GraphqlFetcherService } from './services/graphql-fetcher.service';
import { FeeCalculatorService } from './services/fee-calculator.service';
import { SwapTransformerService } from './services/swap-transformer.service';
import { IngestionOrchestratorService } from './services/ingestion-orchestrator.service';
import { SwapIngestionScheduler } from './schedulers/swap-ingestion.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([SwapRaw]),
    GraphqlClientModule,
    CommonModule,
    DatabaseModule,
  ],
  providers: [
    GraphqlFetcherService,
    FeeCalculatorService,
    SwapTransformerService,
    IngestionOrchestratorService,
    SwapIngestionScheduler,
  ],
  exports: [
    IngestionOrchestratorService,
    GraphqlFetcherService,
    FeeCalculatorService,
    SwapTransformerService,
  ],
})
export class IngestionModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { MoneyMarketRaw } from '../database/entities';
import { GraphqlClientModule } from '../graphql-client/graphql-client.module';
import { CommonModule } from '../common/common.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { MoneyMarketFetcherService } from './services/money-market-fetcher.service';
import { LiquidationFeeCalculatorService } from './services/liquidation-fee-calculator.service';
import { LiquidationTransformerService } from './services/liquidation-transformer.service';
import { MoneyMarketOrchestratorService } from './services/money-market-orchestrator.service';
import { MoneyMarketIngestionScheduler } from './schedulers/money-market-ingestion.scheduler';

/**
 * Money Market Module
 * Handles liquidation fee tracking and ingestion
 * Uses liquidation-first processing strategy for efficiency
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([MoneyMarketRaw]),
    ScheduleModule.forRoot(),
    GraphqlClientModule,
    CommonModule,
    IngestionModule, // Import to access GraphqlFetcherService
  ],
  providers: [
    MoneyMarketFetcherService,
    LiquidationFeeCalculatorService,
    LiquidationTransformerService,
    MoneyMarketOrchestratorService,
    MoneyMarketIngestionScheduler,
  ],
  exports: [
    MoneyMarketOrchestratorService,
    MoneyMarketFetcherService,
    LiquidationFeeCalculatorService,
    LiquidationTransformerService,
  ],
})
export class MoneyMarketModule {}

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
import { PeplLiquidationFetcherService } from './services/pepl-liquidation-fetcher.service';
import { PeplProfitCalculatorService } from './services/pepl-profit-calculator.service';
import { PeplProfitTransformerService } from './services/pepl-profit-transformer.service';
import { PeplLiquidationOrchestratorService } from './services/pepl-liquidation-orchestrator.service';
import { PeplLiquidationScheduler } from './schedulers/pepl-liquidation.scheduler';
import { AssetReserveFetcherService } from './services/asset-reserve-fetcher.service';
import { AssetReserveCalculatorService } from './services/asset-reserve-calculator.service';
import { AssetReserveTransformerService } from './services/asset-reserve-transformer.service';
import { AssetReserveOrchestratorService } from './services/asset-reserve-orchestrator.service';
import { AssetReserveScheduler } from './schedulers/asset-reserve.scheduler';

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
    PeplLiquidationFetcherService,
    PeplProfitCalculatorService,
    PeplProfitTransformerService,
    PeplLiquidationOrchestratorService,
    PeplLiquidationScheduler,
    AssetReserveFetcherService,
    AssetReserveCalculatorService,
    AssetReserveTransformerService,
    AssetReserveOrchestratorService,
    AssetReserveScheduler,
  ],
  exports: [
    MoneyMarketOrchestratorService,
    MoneyMarketFetcherService,
    LiquidationFeeCalculatorService,
    LiquidationTransformerService,
  ],
})
export class MoneyMarketModule {}

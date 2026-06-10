import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule } from '../common/common.module';
import { DatabaseModule } from '../database/database.module';
import { BorrowAprRaw } from '../database/entities/borrow-apr-raw.entity';
import { HsmRevenueRaw } from '../database/entities/hsm-revenue-raw.entity';
import { GraphqlClientModule } from '../graphql-client/graphql-client.module';
import { BorrowAprScheduler } from './schedulers/borrow-apr.scheduler';
import { HsmRevenueScheduler } from './schedulers/hsm-revenue.scheduler';
import { BorrowAprFetcherService } from './services/borrow-apr-fetcher.service';
import { BorrowAprCalculatorService } from './services/borrow-apr-calculator.service';
import { BorrowAprOrchestratorService } from './services/borrow-apr-orchestrator.service';
import { BorrowAprTransformerService } from './services/borrow-apr-transformer.service';
import { HsmRevenueCalculatorService } from './services/hsm-revenue-calculator.service';
import { HsmRevenueFetcherService } from './services/hsm-revenue-fetcher.service';
import { HsmRevenueOrchestratorService } from './services/hsm-revenue-orchestrator.service';
import { HsmRevenueTransformerService } from './services/hsm-revenue-transformer.service';

/**
 * Module for Hollar product features
 * Includes HSM revenue ingestion and Borrow APR ingestion
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([HsmRevenueRaw, BorrowAprRaw]),
    GraphqlClientModule,
    CommonModule,
    DatabaseModule,
  ],
  providers: [
    HsmRevenueFetcherService,
    HsmRevenueCalculatorService,
    HsmRevenueTransformerService,
    HsmRevenueOrchestratorService,
    HsmRevenueScheduler,
    BorrowAprFetcherService,
    BorrowAprCalculatorService,
    BorrowAprTransformerService,
    BorrowAprOrchestratorService,
    BorrowAprScheduler,
  ],
  exports: [HsmRevenueOrchestratorService],
})
export class HollarModule {}

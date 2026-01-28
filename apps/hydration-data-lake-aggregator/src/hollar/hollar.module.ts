import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule } from '../common/common.module';
import { HsmRevenueRaw } from '../database/entities/hsm-revenue-raw.entity';
import { GraphqlClientModule } from '../graphql-client/graphql-client.module';
import { HsmRevenueScheduler } from './schedulers/hsm-revenue.scheduler';
import { HsmRevenueCalculatorService } from './services/hsm-revenue-calculator.service';
import { HsmRevenueFetcherService } from './services/hsm-revenue-fetcher.service';
import { HsmRevenueOrchestratorService } from './services/hsm-revenue-orchestrator.service';
import { HsmRevenueTransformerService } from './services/hsm-revenue-transformer.service';

/**
 * Module for Hollar product features
 * Currently includes HSM revenue ingestion and aggregation
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([HsmRevenueRaw]),
    GraphqlClientModule,
    CommonModule,
  ],
  providers: [
    HsmRevenueFetcherService,
    HsmRevenueCalculatorService,
    HsmRevenueTransformerService,
    HsmRevenueOrchestratorService,
    HsmRevenueScheduler,
  ],
  exports: [HsmRevenueOrchestratorService],
})
export class HollarModule {}

import {
  Injectable,
  Logger,
} from '@nestjs/common';

import { HsmRevenueRaw } from '../../database/entities/hsm-revenue-raw.entity';
import {
  AaveFacilitatorHistoricalDataNode,
} from '../../graphql-client/types/graphql-response.types';
import { CalculatedHsmRevenue } from './hsm-revenue-calculator.service';

/**
 * Service responsible for transforming calculated HSM revenues into database entities
 * Maps calculated revenue components to HsmRevenueRaw entity structure
 */
@Injectable()
export class HsmRevenueTransformerService {
  private readonly logger = new Logger(HsmRevenueTransformerService.name);

  /**
   * Transform HSM revenue data into database entities
   *
   * @param events - Facilitator events
   * @param calculatedRevenues - Map of event ID to calculated revenue
   * @returns Array of HsmRevenueRaw entities
   */
  transformToEntities(
    events: AaveFacilitatorHistoricalDataNode[],
    calculatedRevenues: Map<string, CalculatedHsmRevenue>,
  ): HsmRevenueRaw[] {
    const entities: HsmRevenueRaw[] = [];

    for (const event of events) {
      const revenue = calculatedRevenues.get(event.id);

      if (!revenue) {
        this.logger.error(
          `No revenue calculated for event ${event.id}, this should not happen`,
        );
        continue;
      }

      const entity = new HsmRevenueRaw();
      entity.time = new Date(event.paraTimestamp);
      entity.block_height = event.paraBlockHeight;
      entity.bucket_level = revenue.bucketLevel;
      entity.total_transferable_norm = revenue.totalTransferableNorm;
      entity.hsm_revenue = revenue.hsmRevenue;
      // ingested_at will be set automatically by DB default

      entities.push(entity);
    }

    const missingCount = entities.filter(
      e => e.total_transferable_norm === '0'
    ).length;

    this.logger.log(
      `Transformed ${entities.length}/${events.length} HSM revenue events into entities (${missingCount} with missing data for later enrichment)`,
    );

    return entities;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

const CONTINUOUS_AGGREGATES = [
  'fees_1min', 'fees_5min', 'fees_10min', 'fees_30min',
  'fees_1hour', 'fees_6hour', 'fees_24hour', 'fees_7day', 'fees_30day',
  'liquidation_fees_1min', 'liquidation_fees_5min', 'liquidation_fees_10min', 'liquidation_fees_30min',
  'liquidation_fees_1hour', 'liquidation_fees_6hour', 'liquidation_fees_24hour', 'liquidation_fees_7day', 'liquidation_fees_30day',
  'hsm_revenue_1min', 'hsm_revenue_5min', 'hsm_revenue_10min', 'hsm_revenue_30min',
  'hsm_revenue_1hour', 'hsm_revenue_6hour', 'hsm_revenue_24hour', 'hsm_revenue_7day', 'hsm_revenue_30day',
  'borrow_apr_1min', 'borrow_apr_5min', 'borrow_apr_10min', 'borrow_apr_30min',
  'borrow_apr_1hour', 'borrow_apr_6hour', 'borrow_apr_24hour', 'borrow_apr_7day', 'borrow_apr_30day',
];

const HSM_DELTA_VIEWS: [string, string][] = [
  ['hsm_revenue_1min', 'hsm_revenue_delta_1min'],
  ['hsm_revenue_5min', 'hsm_revenue_delta_5min'],
  ['hsm_revenue_10min', 'hsm_revenue_delta_10min'],
  ['hsm_revenue_30min', 'hsm_revenue_delta_30min'],
  ['hsm_revenue_1hour', 'hsm_revenue_delta_1hour'],
  ['hsm_revenue_6hour', 'hsm_revenue_delta_6hour'],
  ['hsm_revenue_24hour', 'hsm_revenue_delta_24hour'],
  ['hsm_revenue_7day', 'hsm_revenue_delta_7day'],
  ['hsm_revenue_30day', 'hsm_revenue_delta_30day'],
];

@Injectable()
export class AggregateRefreshService {
  private readonly logger = new Logger(AggregateRefreshService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async refreshAll(): Promise<void> {
    this.logger.log('Starting full aggregate refresh');

    for (const aggregate of CONTINUOUS_AGGREGATES) {
      await this.dataSource.query(
        `CALL refresh_continuous_aggregate($1, NULL, NULL)`,
        [aggregate],
      );
      this.logger.debug(`Refreshed ${aggregate}`);
    }

    for (const [sourceView, deltaView] of HSM_DELTA_VIEWS) {
      await this.dataSource.query(
        `SELECT populate_hsm_revenue_delta_full($1, $2)`,
        [sourceView, deltaView],
      );
      this.logger.debug(`Populated ${deltaView}`);
    }

    this.logger.log('Completed full aggregate refresh');
  }
}

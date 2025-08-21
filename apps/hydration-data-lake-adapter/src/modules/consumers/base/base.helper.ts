import { Controller, Logger } from '@nestjs/common';
import { AppConfig } from '../../config';
import { ConsumerType, ApiVersion } from '../types';

@Controller()
export class BaseConsumerHelper {
  protected readonly logger = new Logger(this.constructor.name, { timestamp: true });

  protected constructor(protected readonly appConfig: AppConfig) {}

  // Common utility methods
  protected createSuccessResponse(data: any) {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      data,
    };
  }

  protected createErrorResponse(error: string, statusCode?: number) {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      error,
      statusCode,
    };
  }

  protected logRequest(consumer: ConsumerType, endpoint: string, params?: any) {
    this.logger.log(`[${consumer}] ${endpoint} called`, params ? JSON.stringify(params) : '');
  }

  protected validateBlockRange(fromBlock: number, toBlock: number): void {
    this.appConfig.validateBlockRange(fromBlock, toBlock);
  }

  protected validatePageSize(pageSize: number): number {
    return this.appConfig.validatePageSize(pageSize);
  }
}

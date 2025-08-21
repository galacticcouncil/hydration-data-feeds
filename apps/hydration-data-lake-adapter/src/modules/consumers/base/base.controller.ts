import { Controller, Logger } from '@nestjs/common';
import { AppConfig } from '../../config';
import { ConsumerType, ApiVersion } from '../types';
import { BaseConsumerHelper } from './base.helper';

@Controller()
export abstract class BaseConsumerController extends BaseConsumerHelper {
  protected readonly logger = new Logger(this.constructor.name, { timestamp: true });

  constructor(protected readonly appConfig: AppConfig) {
    super(appConfig);
  }

  // Abstract methods that each consumer must implement
  abstract getConsumerType(): ConsumerType;
  abstract getApiVersion(): ApiVersion;
  abstract getBasePath(): string;
}

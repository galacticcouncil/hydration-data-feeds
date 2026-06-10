import { Injectable, Logger, ValidationError } from '@nestjs/common';
import { AppConfig } from '../../../config';
import { DexScreenerAsset, DexScreenerSwapEvent } from './dexscreener.interfaces';
import { plainToClass } from 'class-transformer';
import { DexScreenerAssetDto, DexScreenerSwapEventDto } from './dto/entities.dto';
import { validate } from 'class-validator';

@Injectable()
export class DexScreenerValidator {
  protected readonly logger = new Logger(this.constructor.name, { timestamp: true });

  constructor(private appConfig: AppConfig) {}

  private formatValidationErrors(errors: ValidationError[]): string[] {
    const formatError = (error: ValidationError, prefix = ''): string[] => {
      const messages: string[] = [];

      if (error.constraints) {
        Object.values(error.constraints).forEach((message) => {
          messages.push(prefix ? `${prefix}.${message}` : message);
        });
      }

      if (error.children && error.children.length > 0) {
        error.children.forEach((childError) => {
          const childPrefix = prefix ? `${prefix}.${error.property}` : error.property;
          messages.push(...formatError(childError, childPrefix));
        });
      }

      return messages;
    };

    return errors.flatMap((error) => formatError(error));
  }

  async isAssetValid(asset: DexScreenerAsset): Promise<boolean> {
    const eventDto = plainToClass(DexScreenerAssetDto, asset);

    const validationErrors: ValidationError[] = await validate(eventDto);

    const errors = this.formatValidationErrors(validationErrors);
    const isValid = errors.length === 0;

    if (!isValid) {
      this.logger.warn(
        `Asset validation failed for [asset: ${asset.id}]. Errors: ${errors.join('; ')}`
      );
    } else {
      this.logger.debug(`Asset validation passed for [asset: ${asset.id}]`);
    }

    return isValid;
  }

  async isSwapEventValid(event: DexScreenerSwapEvent): Promise<boolean> {
    const eventDto = plainToClass(DexScreenerSwapEventDto, event);

    const validationErrors: ValidationError[] = await validate(eventDto);

    const errors = this.formatValidationErrors(validationErrors);
    const isValid = errors.length === 0;

    if (!isValid) {
      this.logger.warn(
        `Swap Event validation failed for [eventIndex: ${event.eventIndex}]. Errors: ${errors.join('; ')}`
      );
    } else {
      this.logger.debug(`Swap Event validation passed for [eventIndex: ${event.eventIndex}]`);
    }

    return isValid;
  }
}

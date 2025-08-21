import { Injectable, Logger } from '@nestjs/common';
import { BaseBlock, BaseAsset, BasePair, BaseEvent } from '../types';

@Injectable()
export abstract class BaseTransformer {
  protected readonly logger = new Logger(this.constructor.name, { timestamp: true });

  // Abstract methods for consumer-specific transformations
  // abstract transformBlock(graphqlData: any): any;
  // abstract transformAsset(graphqlData: any): any;
  // abstract transformPair(graphqlData: any): any;
  // abstract transformEvents(graphqlData: any): any;

  // Common utility methods for data transformation
  protected normalizeAddress(address: string): string {
    // This could be extended to implement checksumming for EVM addresses
    return address;
  }

  protected formatDecimal(value: string | number, decimals: number = 18): string {
    if (typeof value === 'string') {
      return value;
    }
    return (value / Math.pow(10, decimals)).toString();
  }

  protected formatTimestamp(timestamp: number): string {
    return new Date(timestamp * 1000).toISOString();
  }

  protected sanitizeMetadata(metadata?: Record<string, any>): Record<string, string> | undefined {
    if (!metadata) return undefined;
    
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata)) {
      sanitized[key] = String(value);
    }
    return sanitized;
  }

  // Base transformation methods that can be extended
  protected transformBaseBlock(graphqlData: any): BaseBlock {
    const blockData = graphqlData.latestBlock || graphqlData.block;
    
    return {
      blockNumber: blockData.number || blockData.blockNumber,
      blockTimestamp: blockData.timestamp || blockData.blockTimestamp,
      metadata: this.sanitizeMetadata(blockData.metadata),
    };
  }

  protected transformBaseAsset(graphqlData: any): BaseAsset {
    const assetData = graphqlData.asset;
    
    return {
      id: assetData.id,
      name: assetData.name,
      symbol: assetData.symbol,
      totalSupply: assetData.totalSupply,
      circulatingSupply: assetData.circulatingSupply,
      metadata: this.sanitizeMetadata(assetData.metadata),
    };
  }

  protected transformBasePair(graphqlData: any): BasePair {
    const pairData = graphqlData.pair;
    
    return {
      id: pairData.id,
      asset0Id: pairData.asset0?.id || pairData.asset0Id,
      asset1Id: pairData.asset1?.id || pairData.asset1Id,
      metadata: this.sanitizeMetadata(pairData.metadata),
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { BlockRange } from '../types/endpoint.types';

/**
 * Service responsible for analyzing GraphQL query variables to extract
 * block range information and update variables for split queries
 */
@Injectable()
export class QueryAnalyzerService {
  private readonly logger = new Logger(QueryAnalyzerService.name);

  /**
   * Extract block range from query variables
   * Supports multiple variable patterns used across different queries
   *
   * @param variables - GraphQL query variables
   * @returns Extracted block range, or null if no range found
   */
  extractBlockRange(variables: Record<string, any>): BlockRange | null {
    if (!variables) {
      return null;
    }

    // Pattern 1: Direct fromBlock/toBlock
    if (
      typeof variables.fromBlock === 'number' &&
      typeof variables.toBlock === 'number'
    ) {
      return {
        fromBlock: variables.fromBlock,
        toBlock: variables.toBlock,
      };
    }

    // Pattern 2: fromBlock with pagination (first, but no explicit toBlock)
    // Assume toBlock is Number.MAX_SAFE_INTEGER (query to head)
    if (
      typeof variables.fromBlock === 'number' &&
      typeof variables.first === 'number' &&
      !variables.toBlock
    ) {
      return {
        fromBlock: variables.fromBlock,
        toBlock: Number.MAX_SAFE_INTEGER,
      };
    }

    // Pattern 3: Filter object with paraBlockHeight comparisons
    if (variables.filter && typeof variables.filter === 'object') {
      const filter = variables.filter;

      if (filter.paraBlockHeight && typeof filter.paraBlockHeight === 'object') {
        const blockFilter = filter.paraBlockHeight;
        const fromBlock = blockFilter.greaterThan ?? blockFilter.greaterThanOrEqualTo ?? 0;
        const toBlock = blockFilter.lessThan ?? blockFilter.lessThanOrEqualTo ?? Number.MAX_SAFE_INTEGER;

        return {
          fromBlock: typeof fromBlock === 'number' ? fromBlock : 0,
          toBlock: typeof toBlock === 'number' ? toBlock : Number.MAX_SAFE_INTEGER,
        };
      }
    }

    // Pattern 4: Array of specific block heights
    if (Array.isArray(variables.blockHeights) && variables.blockHeights.length > 0) {
      const blocks = variables.blockHeights.filter((b: any) => typeof b === 'number');
      if (blocks.length > 0) {
        return {
          fromBlock: Math.min(...blocks),
          toBlock: Math.max(...blocks),
        };
      }
    }

    // Pattern 5: Single block height
    if (typeof variables.blockHeight === 'number') {
      return {
        fromBlock: variables.blockHeight,
        toBlock: variables.blockHeight,
      };
    }

    // Pattern 6: maxBlockHeight (used in HSM revenue fallback queries)
    if (typeof variables.maxBlockHeight === 'number') {
      return {
        fromBlock: 0,
        toBlock: variables.maxBlockHeight,
      };
    }

    // No recognizable block range pattern found
    return null;
  }

  /**
   * Update query variables with a new block range
   * Modifies the variables to query a specific block range while preserving
   * all other parameters
   *
   * @param variables - Original query variables
   * @param newRange - New block range to apply
   * @returns Updated variables object
   */
  updateBlockRangeVariables(
    variables: Record<string, any>,
    newRange: BlockRange,
  ): Record<string, any> {
    // Clone variables to avoid mutations
    const updated = { ...variables };

    // Pattern 1 & 2: Direct fromBlock/toBlock
    if ('fromBlock' in updated || 'toBlock' in updated) {
      updated.fromBlock = newRange.fromBlock;
      // Only update toBlock if it's not Number.MAX_SAFE_INTEGER
      // (to preserve pagination behavior)
      if (newRange.toBlock !== Number.MAX_SAFE_INTEGER) {
        updated.toBlock = newRange.toBlock;
      }
      return updated;
    }

    // Pattern 3: Filter object with paraBlockHeight
    if (updated.filter && typeof updated.filter === 'object') {
      updated.filter = { ...updated.filter };
      if (updated.filter.paraBlockHeight) {
        updated.filter.paraBlockHeight = {
          ...updated.filter.paraBlockHeight,
        };

        // Update greaterThan/greaterThanOrEqualTo
        if ('greaterThan' in updated.filter.paraBlockHeight) {
          updated.filter.paraBlockHeight.greaterThan = newRange.fromBlock;
        } else if ('greaterThanOrEqualTo' in updated.filter.paraBlockHeight) {
          updated.filter.paraBlockHeight.greaterThanOrEqualTo = newRange.fromBlock;
        }

        // Update lessThan/lessThanOrEqualTo
        if (newRange.toBlock !== Number.MAX_SAFE_INTEGER) {
          if ('lessThan' in updated.filter.paraBlockHeight) {
            updated.filter.paraBlockHeight.lessThan = newRange.toBlock;
          } else if ('lessThanOrEqualTo' in updated.filter.paraBlockHeight) {
            updated.filter.paraBlockHeight.lessThanOrEqualTo = newRange.toBlock;
          }
        }

        return updated;
      }
    }

    // Pattern 4: Array of specific block heights
    if (Array.isArray(updated.blockHeights)) {
      updated.blockHeights = updated.blockHeights.filter(
        (b: any) =>
          typeof b === 'number' && b >= newRange.fromBlock && b <= newRange.toBlock,
      );
      return updated;
    }

    // Pattern 5: Single block height
    if ('blockHeight' in updated) {
      // For single block queries, only include if within range
      if (
        updated.blockHeight >= newRange.fromBlock &&
        updated.blockHeight <= newRange.toBlock
      ) {
        return updated;
      }
      // Block is outside range, return updated variables (query will return empty)
      return updated;
    }

    // Pattern 6: maxBlockHeight
    if ('maxBlockHeight' in updated) {
      updated.maxBlockHeight = Math.min(updated.maxBlockHeight, newRange.toBlock);
      return updated;
    }

    // If no block range pattern found, return original variables
    this.logger.warn('Could not update block range variables: no recognized pattern');
    return updated;
  }

  /**
   * Check if variables contain any block range information
   *
   * @param variables - GraphQL query variables
   * @returns true if variables contain block range info, false otherwise
   */
  hasBlockRange(variables: Record<string, any>): boolean {
    return this.extractBlockRange(variables) !== null;
  }

  /**
   * Estimate if a query might span multiple endpoints
   * This is a heuristic check to help with logging and optimization
   *
   * @param variables - GraphQL query variables
   * @param endpointBlockSize - Typical block range size per endpoint
   * @returns true if query likely spans multiple endpoints
   */
  likelySpansMultipleEndpoints(
    variables: Record<string, any>,
    endpointBlockSize: number = 500000,
  ): boolean {
    const range = this.extractBlockRange(variables);
    if (!range) {
      return false;
    }

    const rangeSize = range.toBlock - range.fromBlock;
    return rangeSize > endpointBlockSize;
  }
}

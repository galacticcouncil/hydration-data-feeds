import { Injectable, Logger } from '@nestjs/common';

/**
 * Service responsible for merging results from multiple GraphQL endpoints
 * Handles different response structures used across the application
 */
@Injectable()
export class ResultMergerService {
  private readonly logger = new Logger(ResultMergerService.name);

  /**
   * Merge results from multiple endpoint queries into a single unified result
   *
   * @param results - Array of results from different endpoints
   * @returns Merged result with combined data
   */
  mergeResults<T = any>(results: T[]): T {
    if (results.length === 0) {
      throw new Error('Cannot merge empty results array');
    }

    if (results.length === 1) {
      return results[0];
    }

    // Detect response structure from first result
    const structure = this.detectResponseStructure(results[0]);

    if (structure.type === 'standard' && structure.dataKey) {
      return this.mergeStandardStructure(results, structure.dataKey);
    } else if (structure.type === 'array' && structure.dataKey) {
      return this.mergeArrayStructure(results, structure.dataKey);
    } else {
      this.logger.warn('Unknown response structure, returning first result');
      return results[0];
    }
  }

  /**
   * Detect the structure of the GraphQL response
   *
   * @param result - Sample result to analyze
   * @returns Structure information
   */
  private detectResponseStructure(result: any): {
    type: 'standard' | 'array' | 'unknown';
    dataKey: string | null;
  } {
    if (!result || typeof result !== 'object') {
      return { type: 'unknown', dataKey: null };
    }

    // Find the data key (e.g., 'swaps', 'liquidations', 'transfers')
    const dataKeys = Object.keys(result);

    for (const key of dataKeys) {
      const value = result[key];

      // Standard structure: { swaps: { nodes: [...], totalCount: N } }
      if (
        value &&
        typeof value === 'object' &&
        Array.isArray(value.nodes) &&
        typeof value.totalCount === 'number'
      ) {
        return { type: 'standard', dataKey: key };
      }

      // Array structure: { transfers: [...] }
      if (Array.isArray(value)) {
        return { type: 'array', dataKey: key };
      }
    }

    return { type: 'unknown', dataKey: null };
  }

  /**
   * Merge results with standard structure: { nodes: [...], totalCount: N }
   *
   * @param results - Array of results to merge
   * @param dataKey - The key containing the data (e.g., 'swaps')
   * @returns Merged result
   */
  private mergeStandardStructure<T = any>(results: T[], dataKey: string): T {
    const allNodes: any[] = [];

    for (const result of results) {
      const data = (result as any)[dataKey];
      if (data && Array.isArray(data.nodes)) {
        allNodes.push(...data.nodes);
      }
    }

    // Sort by paraBlockHeight (ascending) to maintain temporal order
    const sortedNodes = this.sortByBlockHeight(allNodes);

    // Build merged result
    const merged = {
      ...results[0],
      [dataKey]: {
        nodes: sortedNodes,
        totalCount: sortedNodes.length,
      },
    };

    return merged as T;
  }

  /**
   * Merge results with array structure: { transfers: [...] }
   *
   * @param results - Array of results to merge
   * @param dataKey - The key containing the array
   * @returns Merged result
   */
  private mergeArrayStructure<T = any>(results: T[], dataKey: string): T {
    const allItems: any[] = [];

    for (const result of results) {
      const data = (result as any)[dataKey];
      if (Array.isArray(data)) {
        allItems.push(...data);
      }
    }

    // Sort by paraBlockHeight (ascending) to maintain temporal order
    const sortedItems = this.sortByBlockHeight(allItems);

    // Build merged result
    const merged = {
      ...results[0],
      [dataKey]: sortedItems,
    };

    return merged as T;
  }

  /**
   * Sort array of items by paraBlockHeight in ascending order
   * Falls back to blockHeight if paraBlockHeight is not available
   *
   * @param items - Array of items to sort
   * @returns Sorted array
   */
  private sortByBlockHeight(items: any[]): any[] {
    return items.sort((a, b) => {
      const aHeight = a.paraBlockHeight ?? a.blockHeight ?? 0;
      const bHeight = b.paraBlockHeight ?? b.blockHeight ?? 0;
      return aHeight - bHeight;
    });
  }

  /**
   * Validate that all results have compatible structures
   * Useful for debugging merge issues
   *
   * @param results - Array of results to validate
   * @returns true if all results are compatible, false otherwise
   */
  validateResultsCompatibility(results: any[]): boolean {
    if (results.length <= 1) {
      return true;
    }

    const firstStructure = this.detectResponseStructure(results[0]);

    for (let i = 1; i < results.length; i++) {
      const currentStructure = this.detectResponseStructure(results[i]);

      if (
        currentStructure.type !== firstStructure.type ||
        currentStructure.dataKey !== firstStructure.dataKey
      ) {
        this.logger.error(
          `Incompatible result structures detected:\n` +
            `- Result 0: ${JSON.stringify(firstStructure)}\n` +
            `- Result ${i}: ${JSON.stringify(currentStructure)}`,
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Remove duplicate items from merged results based on a unique key
   * Useful when endpoints have overlapping data
   *
   * @param items - Array of items
   * @param uniqueKey - Key to use for deduplication (e.g., 'id', 'swapId')
   * @returns Deduplicated array
   */
  deduplicateByKey(items: any[], uniqueKey: string): any[] {
    const seen = new Set<any>();
    const deduplicated: any[] = [];

    for (const item of items) {
      const keyValue = item[uniqueKey];
      if (keyValue !== undefined && !seen.has(keyValue)) {
        seen.add(keyValue);
        deduplicated.push(item);
      } else if (keyValue === undefined) {
        // If item doesn't have the unique key, keep it
        deduplicated.push(item);
      }
    }

    return deduplicated;
  }
}

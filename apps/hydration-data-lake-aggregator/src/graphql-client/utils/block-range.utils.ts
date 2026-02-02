import {
  NormalizedEndpointConfig,
  BlockRange,
  EndpointAssignment,
} from '../types/endpoint.types';

/**
 * Check if a single block falls within a block range (inclusive)
 *
 * @param block - Block height to check
 * @param range - Block range to check against
 * @returns true if block is within range, false otherwise
 */
export function isBlockInRange(block: number, range: BlockRange): boolean {
  return block >= range.fromBlock && block <= range.toBlock;
}

/**
 * Check if two block ranges have any overlap
 *
 * @param range1 - First block range
 * @param range2 - Second block range
 * @returns true if ranges overlap, false otherwise
 */
export function doBlockRangesOverlap(
  range1: BlockRange,
  range2: BlockRange,
): boolean {
  return (
    range1.fromBlock <= range2.toBlock && range2.fromBlock <= range1.toBlock
  );
}

/**
 * Calculate the intersection of two block ranges
 *
 * @param range1 - First block range
 * @param range2 - Second block range
 * @returns Intersection block range, or null if no overlap
 */
export function getBlockRangeIntersection(
  range1: BlockRange,
  range2: BlockRange,
): BlockRange | null {
  if (!doBlockRangesOverlap(range1, range2)) {
    return null;
  }

  return {
    fromBlock: Math.max(range1.fromBlock, range2.fromBlock),
    toBlock: Math.min(range1.toBlock, range2.toBlock),
  };
}

/**
 * Find all endpoints that cover the requested block range and calculate
 * the specific block range assignments for each endpoint
 *
 * @param endpoints - Array of all configured endpoints
 * @param requestedRange - The block range requested by the query
 * @returns Array of endpoint assignments with specific block ranges
 * @throws Error if no endpoints cover the requested range
 */
export function findEndpointsForBlockRange(
  endpoints: NormalizedEndpointConfig[],
  requestedRange: BlockRange,
): EndpointAssignment[] {
  const assignments: EndpointAssignment[] = [];

  // Sort endpoints by fromBlockHeight to process in order
  const sortedEndpoints = [...endpoints].sort(
    (a, b) => a.fromBlockHeight - b.fromBlockHeight,
  );

  for (const endpoint of sortedEndpoints) {
    const endpointRange: BlockRange = {
      fromBlock: endpoint.fromBlockHeight,
      toBlock: endpoint.toBlockHeight,
    };

    const intersection = getBlockRangeIntersection(
      endpointRange,
      requestedRange,
    );

    if (intersection) {
      assignments.push({
        endpoint,
        blockRange: intersection,
      });
    }
  }

  if (assignments.length === 0) {
    throw new Error(
      `No endpoint configured for block range ${requestedRange.fromBlock}-${requestedRange.toBlock}. ` +
        `Available endpoints cover: ${sortedEndpoints
          .map(
            (e) =>
              `${e.fromBlockHeight}-${e.isHeadEndpoint ? '∞' : e.toBlockHeight}`,
          )
          .join(', ')}`,
    );
  }

  return assignments;
}

/**
 * Check if a block range is fully covered by configured endpoints
 *
 * @param endpoints - Array of all configured endpoints
 * @param range - The block range to check
 * @returns true if range is fully covered, false otherwise
 */
export function isRangeCovered(
  endpoints: NormalizedEndpointConfig[],
  range: BlockRange,
): boolean {
  try {
    const assignments = findEndpointsForBlockRange(endpoints, range);

    // Sort assignments by block range
    const sortedAssignments = assignments.sort(
      (a, b) => a.blockRange.fromBlock - b.blockRange.fromBlock,
    );

    // Check if first assignment covers the start of the range
    if (sortedAssignments[0].blockRange.fromBlock > range.fromBlock) {
      return false;
    }

    // Check for gaps between assignments
    for (let i = 0; i < sortedAssignments.length - 1; i++) {
      const current = sortedAssignments[i];
      const next = sortedAssignments[i + 1];

      // There's a gap if next assignment doesn't start where current ends
      if (next.blockRange.fromBlock > current.blockRange.toBlock + 1) {
        return false;
      }
    }

    // Check if last assignment covers the end of the range
    const lastAssignment = sortedAssignments[sortedAssignments.length - 1];
    if (lastAssignment.blockRange.toBlock < range.toBlock) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get the endpoint that should handle getCurrentBlockHeight queries
 * This is typically the "head" endpoint (with toBlockHeight: -1)
 * or the endpoint with the highest toBlockHeight
 *
 * @param endpoints - Array of all configured endpoints
 * @returns The endpoint to use for getCurrentBlockHeight
 * @throws Error if no endpoints are configured
 */
export function getHeadEndpoint(
  endpoints: NormalizedEndpointConfig[],
): NormalizedEndpointConfig {
  if (endpoints.length === 0) {
    throw new Error('No endpoints configured');
  }

  // First, check if there's a designated head endpoint
  const headEndpoint = endpoints.find((e) => e.isHeadEndpoint);
  if (headEndpoint) {
    return headEndpoint;
  }

  // Otherwise, return the endpoint with the highest toBlockHeight
  return endpoints.reduce((highest, current) =>
    current.toBlockHeight > highest.toBlockHeight ? current : highest,
  );
}

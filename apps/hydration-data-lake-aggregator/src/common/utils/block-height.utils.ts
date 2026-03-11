/**
 * Extracts and deduplicates block heights from an array of items that have a
 * `paraBlockHeight` property, returning them sorted in ascending order.
 */
export function extractUniqueBlockHeights<T extends { paraBlockHeight: number }>(
  items: T[],
): number[] {
  const blockSet = new Set<number>();
  items.forEach((item) => blockSet.add(item.paraBlockHeight));
  return Array.from(blockSet).sort((a, b) => a - b);
}

/**
 * Returns the highest `paraBlockHeight` in an array of items.
 * Returns `fallback` (default 0) when the array is empty, avoiding the
 * `-Infinity` result that `Math.max(...[])` produces.
 */
export function getMaxBlockHeight<T extends { paraBlockHeight: number }>(
  items: T[],
  fallback = 0,
): number {
  if (items.length === 0) return fallback;
  return items.reduce(
    (max, item) => (item.paraBlockHeight > max ? item.paraBlockHeight : max),
    items[0].paraBlockHeight,
  );
}

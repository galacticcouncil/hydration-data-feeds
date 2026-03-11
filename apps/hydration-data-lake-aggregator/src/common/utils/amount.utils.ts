/**
 * Converts a raw blockchain integer amount to a human-readable decimal string.
 * Uses BigInt arithmetic to avoid floating-point precision loss.
 *
 * Example: normalizeAmount('1500000000000', 12) → '1.5'
 */
export function normalizeAmount(rawAmount: string, decimals: number): string {
  try {
    const amount = BigInt(rawAmount);
    const divisor = BigInt(10 ** decimals);

    const integerPart = amount / divisor;
    const remainder = amount % divisor;

    const decimalPart = remainder.toString().padStart(decimals, '0');
    const trimmedDecimal = decimalPart.replace(/0+$/, '');

    if (trimmedDecimal.length === 0) {
      return integerPart.toString();
    }

    return `${integerPart}.${trimmedDecimal}`;
  } catch {
    return '0';
  }
}

/**
 * Adds two decimal number strings using BigInt arithmetic to preserve full precision.
 * Replaces the previous parseFloat-based approach which lost precision beyond 15–16
 * significant digits.
 *
 * Example: addNormalizedAmounts('1.5', '2.75') → '4.25'
 */
export function addNormalizedAmounts(a: string, b: string): string {
  try {
    const parseDecimal = (s: string): { int: string; frac: string } => {
      const [int, frac = ''] = s.split('.');
      return { int, frac };
    };

    const pa = parseDecimal(a);
    const pb = parseDecimal(b);

    const maxDecimals = Math.max(pa.frac.length, pb.frac.length);

    // Pad fractional parts to the same length then form scaled integers
    const aScaled = BigInt(pa.int + pa.frac.padEnd(maxDecimals, '0'));
    const bScaled = BigInt(pb.int + pb.frac.padEnd(maxDecimals, '0'));

    const sum = aScaled + bScaled;

    if (maxDecimals === 0) {
      return sum.toString();
    }

    const scale = BigInt(10 ** maxDecimals);
    const integerPart = sum / scale;
    const remainder = sum % scale;
    const trimmedDecimal = remainder.toString().padStart(maxDecimals, '0').replace(/0+$/, '');

    if (trimmedDecimal.length === 0) {
      return integerPart.toString();
    }

    return `${integerPart}.${trimmedDecimal}`;
  } catch {
    return a;
  }
}

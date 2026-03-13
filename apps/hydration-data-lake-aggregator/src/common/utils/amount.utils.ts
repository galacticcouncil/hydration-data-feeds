/**
 * Converts a raw blockchain integer amount to a human-readable decimal string.
 * Uses BigInt arithmetic to avoid floating-point precision loss.
 *
 * Example: normalizeAmount('1500000000000', 12) → '1.5'
 */
export function normalizeAmount(rawAmount: string, decimals: number): string {
  try {
    const amount = BigInt(rawAmount);
    const divisor = BigInt(10) ** BigInt(decimals);

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

    const scale = BigInt(10) ** BigInt(maxDecimals);
    const integerPart = sum / scale;
    const remainder = sum % scale;
    const trimmedDecimal = remainder.toString().padStart(maxDecimals, '0').replace(/0+$/, '');

    if (trimmedDecimal.length === 0) {
      return integerPart.toString();
    }

    return `${integerPart}.${trimmedDecimal}`;
  } catch (error) {
    // Log malformed inputs so upstream data quality issues are traceable
    console.error(`addNormalizedAmounts failed for inputs a="${a}", b="${b}": ${error}`);
    return a;
  }
}

/**
 * Subtracts two decimal number strings using BigInt arithmetic to preserve full precision.
 * Computes a - b. Returns a negative string if b > a.
 *
 * Example: subtractNormalizedAmounts('4.25', '1.5') → '2.75'
 */
export function subtractNormalizedAmounts(a: string, b: string): string {
  try {
    const parseDecimal = (s: string): { int: string; frac: string; negative: boolean } => {
      const negative = s.startsWith('-');
      const abs = negative ? s.slice(1) : s;
      const [int, frac = ''] = abs.split('.');
      return { int, frac, negative };
    };

    const pa = parseDecimal(a);
    const pb = parseDecimal(b);

    const maxDecimals = Math.max(pa.frac.length, pb.frac.length);

    const toScaled = (p: { int: string; frac: string; negative: boolean }): bigint => {
      const scaled = BigInt(p.int + p.frac.padEnd(maxDecimals, '0'));
      return p.negative ? -scaled : scaled;
    };

    const diff = toScaled(pa) - toScaled(pb);

    if (maxDecimals === 0) {
      return diff.toString();
    }

    const scale = BigInt(10) ** BigInt(maxDecimals);
    const negative = diff < 0n;
    const absDiff = negative ? -diff : diff;
    const integerPart = absDiff / scale;
    const remainder = absDiff % scale;
    const trimmedDecimal = remainder.toString().padStart(maxDecimals, '0').replace(/0+$/, '');

    const result =
      trimmedDecimal.length === 0
        ? integerPart.toString()
        : `${integerPart}.${trimmedDecimal}`;

    return negative ? `-${result}` : result;
  } catch (error) {
    console.error(`subtractNormalizedAmounts failed for inputs a="${a}", b="${b}": ${error}`);
    return a;
  }
}

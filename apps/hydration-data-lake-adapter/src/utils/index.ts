import { encodeAddress } from '@polkadot/util-crypto';
import { hexToU8a } from '@polkadot/util';
import BigNumber from 'bignumber.js';

export function* splitRangeIntoBatches(
  fromBlock: number,
  toBlock: number,
  maxBatchSize: number
): Generator<{ from: number; to: number }> {
  let currentFrom = fromBlock;

  while (currentFrom <= toBlock) {
    const currentTo = Math.min(currentFrom + maxBatchSize - 1, toBlock);
    yield { from: currentFrom, to: currentTo };
    currentFrom = currentTo + 1;
  }
}

export function publicKeyToSs58(key: string, prefix: number = 0): string {
  return encodeAddress(hexToU8a(key), prefix);
}

/**
 * Converts a number from exponential notation to decimal notation, adjusting by a specified number of decimals.
 */
export function fromExpToDecimalNotation(input: BigNumber | string, decimals: number): BigNumber {
  try {
    const numericInput = BigNumber(input);

    if (!numericInput.isFinite() || numericInput.isNaN()) {
      throw new Error(`Invalid input: 'input' is not a finite number. Received: ${input}`);
    }

    if (!Number.isInteger(decimals) || decimals < 0) {
      throw new Error(
        `Invalid decimals: 'decimals' must be a non-negative integer. Received: ${decimals}`
      );
    }

    const result = numericInput.dividedBy(BigNumber(10).pow(decimals));

    if (!result.isFinite() || result.isNaN()) {
      throw new Error(`Computation resulted in an invalid BigNumber: ${result}`);
    }

    return result;
  } catch (error) {
    console.error(`Error in fromExponentialToDecimalNotation: ${error?.message}`);
    throw error;
  }
}

/**
 * Converts a decimal representation of a number into its exponential notation representation by adjusting it with the provided number of decimals.
 */
export function fromDecimalToExpNotation(input: BigNumber | string, decimals: number): BigNumber {
  try {
    const numericInput = BigNumber(input);

    if (!numericInput.isFinite() || numericInput.isNaN()) {
      throw new Error(`Invalid input: 'input' is not a finite number. Received: ${input}`);
    }

    if (!Number.isInteger(decimals) || decimals < 0) {
      throw new Error(
        `Invalid decimals: 'decimals' must be a non-negative integer. Received: ${decimals}`
      );
    }

    const result = numericInput.multipliedBy(BigNumber(10).pow(decimals));

    if (!result.isFinite() || result.isNaN()) {
      throw new Error(`Computation resulted in an invalid BigNumber: ${result}`);
    }

    return result;
  } catch (error) {
    console.error(
      // @ts-ignore
      `Error in fromDecimalToExponentialNotation: ${error?.message}`
    );
    throw error;
  }
}

import { Injectable } from '@nestjs/common';

import { normalizeAmount } from '../../common/utils/amount.utils';
import { BORROW_APR_TREASURY_ADDRESS } from '../../common/constants/blockchain-addresses.constants';
import { BorrowAprTransferNode } from '../../graphql-client/types/graphql-response.types';

export interface BorrowAprCalculation {
  signedAmount: string;
  direction: 'IN' | 'OUT';
}

@Injectable()
export class BorrowAprCalculatorService {
  /**
   * Calculate signed amount and direction for a single Borrow APR transfer.
   * Incoming (TO treasury) → positive amount, direction = 'IN'
   * Outgoing (FROM treasury TO zero) → negative amount, direction = 'OUT'
   */
  calculate(
    transfer: BorrowAprTransferNode,
    decimals: number,
  ): BorrowAprCalculation {
    const normalizedAmount = normalizeAmount(transfer.amount, decimals);
    const isIncoming = transfer.toId.toLowerCase().includes(BORROW_APR_TREASURY_ADDRESS);
    const direction = isIncoming ? ('IN' as const) : ('OUT' as const);
    const signedAmount = isIncoming
      ? normalizedAmount
      : (-parseFloat(normalizedAmount)).toString();

    return { signedAmount, direction };
  }
}

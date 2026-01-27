import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * Entity for tracking liquidation fees from money market operations.
 * Stores minimal data focused on treasury fee collection for timeseries analysis.
 */
@Entity('money_market_raw')
export class MoneyMarketRaw {
  @PrimaryColumn({ type: 'timestamptz' })
  time: Date; // From paraTimestamp - used for timeseries bucketing

  @PrimaryColumn({ type: 'varchar', length: 255 })
  liquidation_event_id: string; // The liquidation eventId (unique identifier)

  @Column({ type: 'integer' })
  block_height: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  liquidation_call_id: string | null; // For reference/debugging only

  // Fee data (treasury transfers)
  @Column({ type: 'text', array: true })
  fee_asset_ids: string[]; // Unique asset IDs from treasury transfers

  @Column({ type: 'jsonb' })
  fee_amounts_raw: Record<string, string>; // { assetId: normalizedAmount }

  @Column({ type: 'jsonb' })
  fee_by_transfer: Array<{
    fromId: string;
    toId: string;
    assetId: string;
    amount: string; // Normalized amount
    feeType: 'LIQUIDATION_PENALTY' | 'PEPL_LIQUIDATION_PROFIT' | 'ASSET_RESERVE' | 'BORROW_APR' | 'OTHER'; // PEPL = protocol exposure profit, ASSET_RESERVE = minted to treasury, BORROW_APR = borrowing APR fees (special case of asset reserve), OTHER = minting from zero address
    transferEventId: string; // For traceability
    countInTotal?: boolean; // Optional flag to control if this entry is counted in total (defaults to true)
  }>;

  // Spot prices for fee assets at this block (for USD conversion)
  @Column({ type: 'jsonb', default: {} })
  fee_spot_prices: Record<string, string>; // { assetId: price_usd }

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  ingested_at: Date;
}

import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Entity for raw Borrow APR transfer data
 * Stores normalized transfer amounts (SIGNED for net flow) and spot prices
 * - Incoming transfers (TO treasury): positive amount
 * - Outgoing transfers (FROM treasury TO zero address): negative amount
 * - Net Borrow APR = SUM(amount * price) in continuous aggregates
 * Used as the base table for borrow_apr_* continuous aggregates
 */
@Entity('borrow_apr_raw')
export class BorrowAprRaw {
  @PrimaryColumn({ type: 'timestamptz' })
  time: Date;

  @PrimaryColumn({ type: 'integer' })
  block_height: number;

  @PrimaryColumn({ type: 'varchar', length: 255 })
  event_id: string;

  @Column({ type: 'numeric', precision: 78, scale: 18 })
  amount: string; // SIGNED: positive for IN, negative for OUT

  @Column({ type: 'varchar', length: 10 })
  direction: string; // 'IN' or 'OUT' for debugging/auditing

  @Column({ type: 'varchar', length: 255 })
  asset_id: string;

  @Column({ type: 'jsonb', default: '{}' })
  fee_spot_prices: Record<string, string>; // { assetId: price_usd }

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  ingested_at: Date;
}

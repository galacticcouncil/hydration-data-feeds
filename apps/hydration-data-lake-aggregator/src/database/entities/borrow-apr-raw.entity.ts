import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Entity for raw Borrow APR transfer data
 * Stores normalized transfer amounts and spot prices
 * USD value is computed in continuous aggregates: amount * (fee_spot_prices->>'assetId')::numeric
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
  amount: string; // normalized to asset decimals

  @Column({ type: 'varchar', length: 255 })
  asset_id: string;

  @Column({ type: 'jsonb', default: '{}' })
  fee_spot_prices: Record<string, string>; // { assetId: price_usd }

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  ingested_at: Date;
}

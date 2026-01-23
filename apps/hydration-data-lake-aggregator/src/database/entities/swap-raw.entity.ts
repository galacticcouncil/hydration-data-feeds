import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('swaps_raw')
export class SwapRaw {
  @PrimaryColumn({ type: 'timestamptz' })
  time: Date;

  @PrimaryColumn({ type: 'varchar', length: 255 })
  swap_id: string;

  @Column({ type: 'integer' })
  block_height: number;

  // Pool/Filler information
  @Column({ type: 'varchar', length: 255 })
  filler_id: string; // Omnipool ID

  @Column({ type: 'varchar', length: 50 })
  filler_type: string; // "Omnipool"

  // Fee data (aggregated from swapFees.nodes)
  @Column({ type: 'text', array: true })
  fee_asset_ids: string[]; // Array of unique asset IDs from all fees

  @Column({ type: 'jsonb' })
  fee_amounts_raw: Record<string, string>; // { assetId: amount }

  // Fee distribution by recipient (tracks where fees go)
  @Column({ type: 'jsonb' })
  fee_by_recipient: Array<{
    recipientId: string;
    destinationType: string;
    assetId: string;
    amount: string;
    feeType: 'asset' | 'protocol' | 'burned';
  }>;

  // Spot prices for fee assets at this block (for USD conversion)
  @Column({ type: 'jsonb', default: {} })
  fee_spot_prices: Record<string, string>; // { assetId: price_usd }

  // Metadata
  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  ingested_at: Date;
}

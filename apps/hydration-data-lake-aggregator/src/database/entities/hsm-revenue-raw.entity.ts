import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('hsm_revenue_raw')
@Index(['block_height'])
export class HsmRevenueRaw {
  @PrimaryColumn({ type: 'timestamptz' })
  time: Date;

  @Column({ type: 'int' })
  block_height: number;

  @Column({ type: 'numeric', precision: 78, scale: 18 })
  bucket_level: string; // Normalized to 18 decimals

  @Column({ type: 'numeric', precision: 78, scale: 18 })
  total_transferable_norm: string; // Already normalized

  @Column({ type: 'numeric', precision: 78, scale: 18 })
  hsm_revenue: string; // Calculated: bucketLevel - totalTransferableNorm

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  ingested_at: Date;
}

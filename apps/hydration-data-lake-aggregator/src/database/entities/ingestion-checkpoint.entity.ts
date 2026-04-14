import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('ingestion_checkpoints')
export class IngestionCheckpoint {
  @PrimaryColumn({ name: 'service_name', type: 'varchar', length: 100 })
  serviceName: string;

  @Column({ name: 'last_block', type: 'integer' })
  lastBlock: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

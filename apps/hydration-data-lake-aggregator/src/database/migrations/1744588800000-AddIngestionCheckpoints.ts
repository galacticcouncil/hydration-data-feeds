import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIngestionCheckpoints1744588800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE ingestion_checkpoints (
        service_name VARCHAR(100) PRIMARY KEY,
        last_block   INTEGER      NOT NULL,
        updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ingestion_checkpoints`);
  }
}

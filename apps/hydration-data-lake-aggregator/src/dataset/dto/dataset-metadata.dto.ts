import { ApiProperty } from '@nestjs/swagger';

export class DatasetInfoDto {
  @ApiProperty({
    description: 'Dataset identifier',
    example: 'fees-aggregates-mainnet',
  })
  id: string;

  @ApiProperty({
    description: 'Dataset version',
    example: '2026.01.29-01',
  })
  version: string;

  @ApiProperty({
    description: 'Network identifier',
    example: 'hydration',
  })
  network: string;
}

export class IndexerInfoDto {
  @ApiProperty({
    description: 'Indexer identifier',
    example: 'orca-multipool-mainnet',
  })
  id: string;

  @ApiProperty({
    description: 'Indexer version',
    example: '2026.01.29-01',
  })
  version: string;

  @ApiProperty({
    description: 'Network identifier',
    example: 'hydration',
  })
  network: string;
}

export class TimeBoundsDto {
  @ApiProperty({
    description: 'Earliest timestamp in dataset',
    example: '2023-01-01T00:00:00Z',
  })
  minTime: string;

  @ApiProperty({
    description: 'Latest timestamp in dataset',
    example: '2026-01-29T01:15:00Z',
  })
  maxTime: string;
}

export class BlockBoundsDto {
  @ApiProperty({
    description: 'Lowest block height in dataset',
    example: 1200000,
  })
  minBlockHeight: number;

  @ApiProperty({
    description: 'Highest block height in dataset',
    example: 9876543,
  })
  maxBlockHeight: number;
}

export class CoverageDto {
  @ApiProperty({
    description: 'Time coverage bounds',
    type: TimeBoundsDto,
  })
  timeBounds: TimeBoundsDto;

  @ApiProperty({
    description: 'Block height coverage bounds',
    type: BlockBoundsDto,
  })
  blockBounds: BlockBoundsDto;
}

export class DatasetMetadataDto {
  @ApiProperty({
    description: 'Metadata schema version',
    example: 1,
  })
  metadataVersion: number;

  @ApiProperty({
    description: 'Dataset information',
    type: DatasetInfoDto,
  })
  dataset: DatasetInfoDto;

  @ApiProperty({
    description: 'Indexer information',
    type: IndexerInfoDto,
  })
  indexer: IndexerInfoDto;

  @ApiProperty({
    description: 'Data coverage information',
    type: CoverageDto,
  })
  coverage: CoverageDto;
}

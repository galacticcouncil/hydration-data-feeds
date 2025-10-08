import { IsNumber, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class DexScreenerGetEventsQueryDto {
  @ApiProperty({
    description: 'Starting block number (inclusive)',
    example: 100,
    type: 'number',
  })
  @IsNumber()
  @Type(() => Number)
  fromBlock: number;

  @ApiProperty({
    description: 'Ending block number (inclusive)',
    example: 150,
    type: 'number',
  })
  @IsNumber()
  @Type(() => Number)
  toBlock: number;
}

export class DexScreenerGetAssetParamsDto {
  @ApiProperty({
    description: 'Asset identifier (usually contract address)',
    example: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    type: 'string',
  })
  @IsString()
  id: string;
}

export class DexScreenerGetPairParamsDto {
  @ApiProperty({
    description: 'Pair identifier (usually contract address)',
    example: '0x11b815efB8f581194ae79006d24E0d814B7697F6',
    type: 'string',
  })
  @IsString()
  id: string;
}

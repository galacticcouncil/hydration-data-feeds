import { IsNumber, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class DexScreenerGetEventsQueryDto {
  @IsNumber()
  @Type(() => Number)
  fromBlock: number;

  @IsNumber()
  @Type(() => Number)
  toBlock: number;
}

export class DexScreenerGetAssetParamsDto {
  @IsString()
  id: string;
}

export class DexScreenerGetPairParamsDto {
  @IsString()
  id: string;
}

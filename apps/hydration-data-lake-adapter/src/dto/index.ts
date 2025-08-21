import { IsNumber, IsString, IsOptional, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class GetEventsQueryDto {
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  fromBlock: number;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  toBlock: number;
}

export class GetAssetParamsDto {
  @IsString()
  id: string;
}

export class GetPairParamsDto {
  @IsString()
  id: string;
}

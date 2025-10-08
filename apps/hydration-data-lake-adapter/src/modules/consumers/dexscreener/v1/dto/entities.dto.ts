import {
  IsEnum,
  IsString,
  IsNumber,
  IsNotEmpty,
  ValidateNested,
  IsOptional,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AssetInOutRequiredConstraint, NotZeroConstraint } from 'src/utils/validators';
import {
  DexScreenerAsset,
  DexScreenerEventReserves,
  DexScreenerEventType,
  DexScreenerSwapEvent,
} from '../dexscreener.interfaces';
import { AssetType } from '../../../../dataSource/types';

class DexScreenerEventReservesDto implements DexScreenerEventReserves {
  @IsString({ message: 'Asset0 reserve must be a string' })
  @IsNotEmpty({ message: 'Asset0 reserve is required' })
  @Validate(NotZeroConstraint)
  asset0: string;

  @IsString({ message: 'Asset1 reserve must be a string' })
  @IsNotEmpty({ message: 'Asset1 reserve is required' })
  @Validate(NotZeroConstraint)
  asset1: string;
}

export class DexScreenerSwapEventDto implements DexScreenerSwapEvent {
  @IsEnum(DexScreenerEventType, {
    message: `Event type must be ${DexScreenerEventType.SWAP}`,
  })
  eventType: DexScreenerEventType;

  @IsString({ message: 'Transaction ID must be a string' })
  @IsNotEmpty({ message: 'Transaction ID is required' })
  txnId: string;

  @IsNumber({}, { message: 'Transaction index must be a number' })
  txnIndex: number;

  @IsNumber({}, { message: 'Event index must be a number' })
  eventIndex: number;

  @IsString({ message: 'Maker address must be a string' })
  @IsNotEmpty({ message: 'Maker address is required' })
  maker: string;

  @IsString({ message: 'Pair ID must be a string' })
  @IsNotEmpty({ message: 'Pair ID is required' })
  pairId: string;

  @IsOptional()
  @Validate(AssetInOutRequiredConstraint)
  asset0In?: number | string;

  @IsOptional()
  @Validate(AssetInOutRequiredConstraint)
  asset1In?: number | string;

  @IsOptional()
  @Validate(AssetInOutRequiredConstraint)
  asset0Out?: number | string;

  @IsOptional()
  @Validate(AssetInOutRequiredConstraint)
  asset1Out?: number | string;

  @IsNotEmpty({ message: 'Price native is required' })
  @Validate(NotZeroConstraint)
  priceNative: number | string;

  @ValidateNested({ message: 'Reserves validation failed' })
  @Type(() => DexScreenerEventReservesDto)
  reserves: DexScreenerEventReservesDto;

  @IsOptional()
  metadata?: Record<string, string>;
}

export class DexScreenerAssetDto implements DexScreenerAsset {
  @IsString({ message: 'Asset ID must be a string' })
  @IsNotEmpty({ message: 'Asset ID is required' })
  id: string;

  @IsString({ message: 'Asset name must be a string' })
  @IsNotEmpty({ message: 'Asset name is required' })
  name: string;

  @IsString({ message: 'Asset symbol must be a string' })
  @IsNotEmpty({ message: 'Asset symbol is required' })
  symbol: string;

  @IsOptional()
  @IsString({ message: 'Total supply must be a string' })
  totalSupply?: string | number;

  @IsOptional()
  @IsString({ message: 'Circulating supply must be a string' })
  circulatingSupply?: string | number;

  @IsOptional()
  @IsString({ message: 'CoinGecko ID must be a string' })
  coinGeckoId?: string;

  @IsOptional()
  @IsString({ message: 'CoinMarketCap ID must be a string' })
  coinMarketCapId?: string;

  @IsOptional()
  metadata?: Record<string, string> & {
    assetType: AssetType;
    decimals: string;
  };
}

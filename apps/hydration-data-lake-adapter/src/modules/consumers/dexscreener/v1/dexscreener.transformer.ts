import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config';
import { BaseTransformer } from '../../base/base.transformer';
import { DexScreenerBlock, DexScreenerAsset } from './dexscreener.interfaces';
import { DatasourceAsset, DatasourceBlock } from '../../../dataSource/graphqlSupport/types';
import { AssetEnhancementService } from '../../../dataSource/dataEnhancement/assets';
import { AssetType } from '../../../dataSource/types';
import { fromExpToDecimalNotation } from '../../../../utils';

@Injectable()
export class DexScreenerTransformer extends BaseTransformer {
  constructor(
    private appConfig: AppConfig,
    private assetEnhancementService: AssetEnhancementService
  ) {
    super();
  }

  transformBlock(blockData: DatasourceBlock): DexScreenerBlock {
    this.logger.debug('Transforming latest block data for DEX Screener');

    const block: DexScreenerBlock = {
      blockNumber: blockData.height,
      blockTimestamp: Math.floor(new Date(blockData.timestamp).getTime() / 1000),
    };

    return block;
  }

  transformAsset({
    id,
    name,
    symbol,
    decimals,
    assetType,
    totalIssuance,
  }: DatasourceAsset & { totalIssuance: string }): DexScreenerAsset {
    this.logger.debug('Transforming asset data for DEX Screener');

    // Get enhancement data for this asset
    const enhancement = this.assetEnhancementService.getAssetEnhancement(id);

    const totalIssuanceDecorated = fromExpToDecimalNotation(
      totalIssuance,
      decimals ?? 18
    ).toFixed();

    const asset: DexScreenerAsset = {
      id,
      name,
      symbol,
      totalSupply: totalIssuanceDecorated,
      circulatingSupply: totalIssuanceDecorated,
      ...(enhancement?.coinGeckoId && { coinGeckoId: enhancement.coinGeckoId }),
      ...(enhancement?.coinMarketCapId && { coinMarketCapId: enhancement.coinMarketCapId }),
      metadata: {
        assetType: assetType as AssetType,
        ...(decimals && { decimals: `${decimals}` }),
      },
    };

    return asset;
  }
}

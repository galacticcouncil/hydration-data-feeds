export interface AssetEnhancementData {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  coinGeckoId?: string;
  coinMarketCapId?: string;
}

export interface AssetEnhancementEntry {
  asset: AssetEnhancementData;
}

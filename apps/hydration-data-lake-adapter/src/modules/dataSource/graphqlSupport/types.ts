import { Block, Asset } from './main/apiTypes';

export type DatasourceBlock = Pick<Block, 'id' | 'height' | 'hash' | 'timestamp'>;

export type DatasourceAsset = Pick<Asset, 'id' | 'symbol' | 'name' | 'decimals'>;

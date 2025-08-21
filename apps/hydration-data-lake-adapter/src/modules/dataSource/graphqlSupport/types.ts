import { Block } from './main/apiTypes';

export type DatasourceBlock = Pick<Block, 'id' | 'height' | 'hash' | 'timestamp'>;

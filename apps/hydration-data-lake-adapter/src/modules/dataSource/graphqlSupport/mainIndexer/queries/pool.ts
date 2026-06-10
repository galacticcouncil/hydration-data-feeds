import gql from 'graphql-tag';
import { AccountFilter } from '../apiTypes';

export const GET_POOL_BY_ACCOUNT = gql`
  query GetPoolByAccount($filter: AccountFilter) {
    accounts(filter: $filter) {
      nodes {
        id
        accountType
        stableswap {
          id
          stableswapAssetsByPoolId {
            nodes {
              assetId
            }
          }
        }
        xykpool {
          id
          assetAId
          assetBId
        }
        lbppool {
          id
          assetAId
          assetBId
        }
      }
    }
  }
`;

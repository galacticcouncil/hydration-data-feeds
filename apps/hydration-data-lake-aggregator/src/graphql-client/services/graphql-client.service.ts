import { Injectable } from '@nestjs/common';
import { Variables } from 'graphql-request';
import type { RequestDocument } from 'graphql-request';

const DI_ERROR = 'GraphqlClientService is a DI placeholder — ensure GraphqlClientModule provides MultiEndpointGraphqlService via useExisting.';

// Stub class whose sole purpose is to declare the DI token interface.
// All methods throw; the real implementation is MultiEndpointGraphqlService.
@Injectable()
export class GraphqlClientService {
  async query<T = any, V extends Variables = Variables>(
    _query: RequestDocument,
    _variables?: V,
  ): Promise<T> {
    throw new Error(DI_ERROR);
  }

  async getCurrentBlockHeight(): Promise<number> {
    throw new Error(DI_ERROR);
  }
}

import { Module } from '@nestjs/common';
import { GraphqlClientService } from './services/graphql-client.service';
import { MultiEndpointGraphqlService } from './services/multi-endpoint-graphql.service';
import { QueryAnalyzerService } from './services/query-analyzer.service';
import { ResultMergerService } from './services/result-merger.service';

@Module({
  providers: [
    // Multi-endpoint services
    QueryAnalyzerService,
    ResultMergerService,
    MultiEndpointGraphqlService,

    // Override GraphqlClientService token so all existing injections
    // transparently resolve to MultiEndpointGraphqlService
    {
      provide: GraphqlClientService,
      useExisting: MultiEndpointGraphqlService,
    },
  ],
  exports: [
    GraphqlClientService,
    MultiEndpointGraphqlService,
  ],
})
export class GraphqlClientModule {}

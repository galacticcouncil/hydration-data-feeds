import { Module } from '@nestjs/common';
import { GraphqlClientService } from './graphql-client.service';
import { MultiEndpointGraphqlService } from './services/multi-endpoint-graphql.service';
import { QueryAnalyzerService } from './services/query-analyzer.service';
import { ResultMergerService } from './services/result-merger.service';

@Module({
  providers: [
    // Legacy single-endpoint client (kept for backwards compatibility)
    GraphqlClientService,

    // Multi-endpoint services
    QueryAnalyzerService,
    ResultMergerService,
    MultiEndpointGraphqlService,

    // Provide transparent replacement via DI alias
    // All services injecting 'GraphqlClient' will get MultiEndpointGraphqlService
    {
      provide: 'GraphqlClient',
      useExisting: MultiEndpointGraphqlService,
    },
  ],
  exports: [
    // Export both for flexibility
    GraphqlClientService,
    MultiEndpointGraphqlService,
    'GraphqlClient', // Export the alias
  ],
})
export class GraphqlClientModule {}

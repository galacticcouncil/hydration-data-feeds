import { Global, Module } from '@nestjs/common';
import { GraphQlClientProviderFactory } from './graphql-client.provider';

@Global()
@Module({
  providers: [GraphQlClientProviderFactory],
  exports: [GraphQlClientProviderFactory],
})
export class ProvidersModule {}

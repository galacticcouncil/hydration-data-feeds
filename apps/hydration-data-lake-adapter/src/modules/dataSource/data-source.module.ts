import { Module } from '@nestjs/common';
import { DataSourceService } from './data-source.service';
import { GraphQlClientProviderFactory } from '../../providers/graphql-client.provider';
import { ProvidersModule } from '../../providers/providers.module';

@Module({
  imports: [ProvidersModule],
  providers: [DataSourceService],
  exports: [DataSourceService],
})
export class DataSourceModule {}

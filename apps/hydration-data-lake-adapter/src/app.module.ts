import { Module } from '@nestjs/common';
import { ConfigurationModule } from './modules/config';
import { ConsumersModule } from './modules/consumers/consumers.module';
import { ConsumerInfoController } from './modules/consumers/consumer-info.controller';
import { DataSourceModule } from './modules/dataSource/data-source.module';
import { ProvidersModule } from './providers/providers.module';

@Module({
  imports: [ProvidersModule, ConfigurationModule, DataSourceModule, ConsumersModule],
  controllers: [ConsumerInfoController],
  providers: [],
})
export class AppModule {}

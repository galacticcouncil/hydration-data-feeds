import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigurationModule } from './modules/config';
import { ConsumersModule } from './modules/consumers/consumers.module';
import { ConsumerInfoController } from './modules/consumers/consumer-info.controller';
import { DataSourceModule } from './modules/dataSource/data-source.module';
import { ProvidersModule } from './providers/providers.module';
import { MonitoringModule, MetricsInterceptor } from './modules/monitoring';

@Module({
  imports: [
    ProvidersModule,
    ConfigurationModule,
    DataSourceModule,
    ConsumersModule,
    MonitoringModule,
  ],
  controllers: [ConsumerInfoController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}

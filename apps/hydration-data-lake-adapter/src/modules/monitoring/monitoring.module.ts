import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { TerminusModule } from '@nestjs/terminus';
import { MetricsInterceptor } from './metrics.interceptor';
import { HealthController } from './health.controller';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
    TerminusModule,
  ],
  controllers: [HealthController],
  providers: [MetricsInterceptor],
  exports: [MetricsInterceptor],
})
export class MonitoringModule {}

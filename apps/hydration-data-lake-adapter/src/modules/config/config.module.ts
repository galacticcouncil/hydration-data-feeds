import { Module, Global, Logger } from '@nestjs/common';
import { AppConfig } from './app.config';

@Global()
@Module({
  providers: [
    {
      provide: AppConfig,
      useFactory: () => {
        return AppConfig.getInstance();
      },
    },
  ],
  exports: [AppConfig],
})
export class ConfigurationModule {}

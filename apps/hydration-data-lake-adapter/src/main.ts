import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { AppConfig, GraphQLConfig } from './modules/config';

async function bootstrap() {
  const logger = new Logger('Bootstrap', { timestamp: true });

  const app = await NestFactory.create(AppModule);

  const appConfig = app.get(AppConfig);

  logger.log('Starting Hydration Data Feed');
  logger.log('Configuration:', JSON.stringify(appConfig.getConfigSummary(), null, 2));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  );

  if (appConfig.ENABLE_CORS) {
    app.enableCors();
    logger.log('CORS enabled');
  }

  if (appConfig.BASE_PATH) {
    app.setGlobalPrefix(appConfig.BASE_PATH);
    logger.log(`Global prefix set to: ${appConfig.BASE_PATH}`);
  }

  await app.listen(appConfig.PORT);
  logger.log(`Application is running on: ${appConfig.getServerUrl()}`);

  // Log available endpoints
  logger.log('Available GraphQL endpoints:', appConfig.graphql.getConfiguredEndpoints().join(', '));
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});

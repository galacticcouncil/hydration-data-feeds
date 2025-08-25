import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  // Configure Swagger/OpenAPI documentation
  if (appConfig.ENABLE_SWAGGER) {
    const config = new DocumentBuilder()
      .setTitle('Hydration Data Lake Adapter')
      .setDescription(
        'DEX Screener Adapter API for Hydration Protocol - provides HTTP endpoints for tracking historical and real-time data from the Hydration decentralized exchange'
      )
      .setVersion('1.0.0')
      .setContact('Hydration Team', 'https://hydration.net', 'support@hydration.net')
      .setLicense('UNLICENSED', '')
      .addTag('dexscreener', 'DEX Screener API endpoints')
      .addTag('health', 'Health check endpoints')
      .addServer(appConfig.getServerUrl(), 'Local development server')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    const swaggerPath = appConfig.BASE_PATH ? `${appConfig.BASE_PATH}/docs` : '/docs';
    SwaggerModule.setup(swaggerPath, app, document, {
      customSiteTitle: 'Hydration Data Lake Adapter API',
      customfavIcon: '/favicon.ico',
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
      },
    });

    const swaggerUrl = `${appConfig.getServerUrl()}${swaggerPath}`;
    logger.log(`Swagger documentation available at: ${swaggerUrl}`);
  }

  await app.listen(appConfig.PORT);
  const baseUrl = appConfig.BASE_PATH ? `${appConfig.getServerUrl()}${appConfig.BASE_PATH}` : appConfig.getServerUrl();
  logger.log(`Application is running on: ${baseUrl}`);

  // Log available endpoints
  logger.log('Available GraphQL endpoints:', appConfig.graphql.getConfiguredEndpoints().join(', '));
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});

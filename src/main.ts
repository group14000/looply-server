import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RateLimitConfigService } from './rate-limit/rate-limit-config/rate-limit-config.service';

async function bootstrap() {
  // rawBody: true is additive — Nest still JSON-parses req.body for every
  // route as before, this just also stashes the exact unparsed bytes on
  // req.rawBody, needed for webhook signature verification (e.g. svix).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);
  const rateLimitConfigService = app.get(RateLimitConfigService);
  const port = configService.get('PORT') || 5000;
  const frontendUrl =
    configService.get('FRONTEND_URL') || 'http://localhost:3000';

  // Express `trust proxy` hop count for rate-limit IP extraction (req.ip/req.ips).
  // Defaults to 0 (off) — safe no-op locally. In production, set TRUST_PROXY_HOPS
  // to the EXACT number of reverse-proxy hops in front of the app. Never trust an
  // unbounded/`true` value — that lets a client spoof X-Forwarded-For to bypass
  // IP-based rate limits.
  app
    .getHttpAdapter()
    .getInstance()
    .set('trust proxy', rateLimitConfigService.trustProxyHops);

  // CORS configuration
  app.enableCors({
    origin: [frontendUrl, `http://localhost:${port}`],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Standard response envelope for every request
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger/OpenAPI docs — mounted directly on the HTTP adapter, so it is not
  // subject to the global ClerkAuthGuard. Every route requires a Clerk session
  // token (see @ApiBearerAuth on controllers); use "Authorize" in the UI to
  // paste one in for try-it-out requests.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Looply API')
    .setDescription('Looply server API documentation')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'clerk-session',
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port);

  console.log(`✅ Application is running on: http://localhost:${port}`);
  console.log(`📘 Swagger docs: http://localhost:${port}/docs`);
  console.log(`🔐 Clerk integration enabled`);
  console.log(`🌐 Frontend URL: ${frontendUrl}`);
}
bootstrap();

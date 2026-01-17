import 'dotenv/config';

// Initialize Sentry FIRST, before any other imports
import { initSentry } from './sentry';
initSentry();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Required for MP/Stripe webhooks signature verification
    bufferLogs: true, // Buffer logs until Winston is ready
  });

  // Use Winston as the application logger
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  // Enable graceful shutdown hooks
  app.enableShutdownHooks();

  // Cookie parser for OAuth httpOnly cookies
  app.use(cookieParser());

  // Security headers with Content Security Policy
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // Required for Mercado Pago SDK
            'https://www.mercadopago.com.ar',
            'https://sdk.mercadopago.com',
            'https://http2.mlstatic.com',
          ],
          styleSrc: ["'self'", "'unsafe-inline'"], // Required for styled-components/emotion
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'https://res.cloudinary.com',
            'https://http2.mlstatic.com',
            'https://lh3.googleusercontent.com', // Google profile pictures
          ],
          fontSrc: ["'self'", 'data:'],
          connectSrc: [
            "'self'",
            'https://www.mercadopago.com.ar',
            'https://api.mercadopago.com',
            'https://events.mercadopago.com',
            'https://api.cloudinary.com',
          ],
          frameSrc: ["'self'", 'https://www.mercadopago.com.ar'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'self'"],
          upgradeInsecureRequests:
            process.env.NODE_ENV === 'production' ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Global validation pipe with configuration from spec
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove properties not in DTO
      forbidNonWhitelisted: true, // Throw error on extra properties
      transform: true, // Auto transform types
      transformOptions: {
        enableImplicitConversion: true, // Convert strings to numbers, etc.
      },
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'stripe-signature',
      'x-signature',
      'x-request-id',
    ],
    exposedHeaders: ['Set-Cookie'], // Expose Set-Cookie header to client
    credentials: true,
  });

  const port = process.env.PORT ?? 3001;

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}. Starting graceful shutdown...`);
    try {
      await app.close();
      logger.log('Application closed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}/graphql`);
}
bootstrap();

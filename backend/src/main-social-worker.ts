import 'dotenv/config';

import { Logger, type LoggerService } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { initSentry } from './sentry';
import { SocialWorkerModule } from './social-worker.module';

initSentry();

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SocialWorkerModule, {
    bufferLogs: true,
  });

  const logger = app.get<LoggerService>(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);
  app.enableShutdownHooks();

  const plainLogger = new Logger('SocialWorkerBootstrap');
  plainLogger.log('Social promotion worker started');

  const shutdown = async (signal: string) => {
    plainLogger.log(`Received ${signal}. Shutting down social worker...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void bootstrap();

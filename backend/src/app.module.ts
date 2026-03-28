import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';
import { GqlThrottlerGuard } from './common/guards/gql-throttler.guard';
import { complexityPlugin } from './common/plugins/complexity.plugin';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { SentryInterceptor } from './common/interceptors/sentry.interceptor';
import { join } from 'path';
import { Request, Response } from 'express';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { winstonConfig } from './common/logger';
import { EventsModule } from './common/events';
import { RepositoriesModule } from './common/repositories';
import { AuthModule } from './auth/auth.module';
import { JwtService } from '@nestjs/jwt';
import { UsersModule } from './users/users.module';
import { RafflesModule } from './raffles/raffles.module';
import { TicketsModule } from './tickets/tickets.module';
import { PaymentsModule } from './payments/payments.module';
import { DisputesModule } from './disputes/disputes.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TasksModule } from './tasks/tasks.module';
import { UploadsModule } from './uploads/uploads.module';
import { ReportsModule } from './reports/reports.module';
import { CategoriesModule } from './categories/categories.module';
import { FavoritesModule } from './favorites/favorites.module';
import { ShippingModule } from './shipping/shipping.module';
import { AuditModule } from './audit/audit.module';
import { MessagingModule } from './messaging/messaging.module';
import { PayoutsModule } from './payouts/payouts.module';
import { ActivityModule } from './activity/activity.module';
import { HealthModule } from './health/health.module';
import { QuestionsModule } from './questions/questions.module';
import { SocialPromotionsModule } from './social-promotions/social-promotions.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth/jwt-auth.guard';
import { CommonModule } from './common/common.module';
import { CacheModule } from './common/cache';
import { validate } from './common/config/env.validation';
// CSRF middleware removed - not needed for JWT-based authentication
// import { CsrfMiddleware } from './common/middleware';

/** Context passed to GraphQL resolvers */
interface GqlContext {
  req: Request;
  res: Response;
  [key: string]: unknown;
}

/** WebSocket connection parameters for subscriptions */
interface WsConnectionParams {
  Authorization?: string;
  authorization?: string;
}

/** Context passed to WebSocket onConnect handler */
interface WsConnectionContext {
  connectionParams?: WsConnectionParams;
}

/** JWT payload structure */
interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

function getBooleanFlag(
  value: boolean | string | undefined,
  defaultValue: boolean,
): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return defaultValue;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
      validate,
    }),
    // Structured logging with Winston
    WinstonModule.forRoot(winstonConfig),
    // Rate limiting configuration
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL', 60) * 1000, // Convert to milliseconds
            limit: config.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
      }),
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule, AuthModule],
      inject: [ConfigService, JwtService],
      useFactory: (config: ConfigService, jwtService: JwtService) => {
        const playgroundEnabled = getBooleanFlag(
          config.get<boolean | string>('GRAPHQL_PLAYGROUND'),
          true,
        );
        const isDev = config.get('NODE_ENV', 'development') !== 'production';
        const debugEnabled = getBooleanFlag(
          config.get<boolean | string>('GRAPHQL_DEBUG'),
          true,
        );

        const enableLandingPage = playgroundEnabled && isDev;

        return {
          autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
          sortSchema: true,
          playground: false,
          debug: debugEnabled,
          introspection: enableLandingPage,
          csrfPrevention: enableLandingPage ? false : true,
          plugins: [
            // Query complexity protection (always enabled)
            complexityPlugin,
            // Dev landing page (only in development with playground enabled)
            ...(enableLandingPage
              ? [ApolloServerPluginLandingPageLocalDefault({ embed: true })]
              : []),
          ],
          context: ({
            req,
            res,
            extra,
          }: {
            req: Request;
            res: Response;
            extra?: Record<string, unknown>;
          }): GqlContext => ({ req, res, ...(extra || {}) }),
          subscriptions: {
            'graphql-ws': {
              onConnect: (
                ctx: WsConnectionContext,
              ): Record<string, unknown> => {
                const raw =
                  ctx.connectionParams?.Authorization ??
                  ctx.connectionParams?.authorization ??
                  '';
                const token =
                  typeof raw === 'string' ? raw.replace(/^Bearer\s+/i, '') : '';

                if (!token) return {};

                try {
                  const payload = jwtService.verify<JwtPayload>(token, {
                    secret: config.getOrThrow<string>('JWT_SECRET'),
                  });
                  return {
                    user: {
                      id: payload.sub,
                      email: payload.email,
                      role: payload.role,
                    },
                  };
                } catch {
                  return {};
                }
              },
            },
            'subscriptions-transport-ws': false,
          },
        };
      },
    }),
    ScheduleModule.forRoot(),
    // Event-driven architecture for decoupled event handling
    EventsModule,
    // Repository pattern for database operations - global module
    RepositoriesModule,
    // Common services (encryption, etc.) - global module
    CommonModule,
    // Caching with Redis (falls back to in-memory if Redis unavailable)
    CacheModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    RafflesModule,
    TicketsModule,
    PaymentsModule,
    DisputesModule,
    AdminModule,
    NotificationsModule,
    TasksModule,
    UploadsModule,
    ReportsModule,
    CategoriesModule,
    FavoritesModule,
    ShippingModule,
    AuditModule,
    MessagingModule,
    PayoutsModule,
    ActivityModule,
    HealthModule,
    QuestionsModule,
    SocialPromotionsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global JWT Auth Guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global Rate Limiting Guard (GraphQL compatible)
    {
      provide: APP_GUARD,
      useClass: GqlThrottlerGuard,
    },
    // Global Sentry Interceptor for error tracking
    {
      provide: APP_INTERCEPTOR,
      useClass: SentryInterceptor,
    },
  ],
})
export class AppModule {
  // CSRF middleware removed - JWT-based auth doesn't need CSRF protection
  // CSRF attacks exploit cookies, but JWT tokens are sent via Authorization header
}

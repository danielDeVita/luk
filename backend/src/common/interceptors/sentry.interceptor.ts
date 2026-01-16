import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, tap } from 'rxjs';
import * as Sentry from '@sentry/node';

/**
 * Sentry Interceptor for NestJS
 *
 * Captures errors and attaches user/GraphQL context for better debugging.
 * Only active when SENTRY_DSN is configured.
 */
@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Skip if Sentry is not configured
    if (!process.env.SENTRY_DSN) {
      return next.handle();
    }

    const contextType = context.getType<string>();

    if (contextType === 'graphql') {
      return this.handleGraphQL(context, next);
    } else if (contextType === 'http') {
      return this.handleHttp(context, next);
    }

    return next.handle();
  }

  private handleGraphQL(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const gqlContext = GqlExecutionContext.create(context);
    const info = gqlContext.getInfo();
    const req = gqlContext.getContext().req;
    const user = req?.user;

    // Set Sentry context
    Sentry.withScope((scope) => {
      // User context
      if (user) {
        scope.setUser({
          id: user.id,
          email: user.email,
        });
      }

      // GraphQL operation context
      scope.setContext('graphql', {
        operationName: info?.fieldName,
        operationType: info?.parentType?.name,
        path: info?.path,
      });

      // Add operation as a tag for filtering
      scope.setTag('graphql.operation', info?.fieldName || 'unknown');
      scope.setTag('graphql.type', info?.parentType?.name || 'unknown');
    });

    return next.handle().pipe(
      tap({
        error: (error) => {
          // Only capture 5xx-like errors
          if (this.shouldCaptureError(error)) {
            Sentry.captureException(error, {
              extra: {
                operationName: info?.fieldName,
                variables: gqlContext.getArgs(),
              },
            });
          }
        },
      }),
    );
  }

  private handleHttp(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    Sentry.withScope((scope) => {
      if (user) {
        scope.setUser({
          id: user.id,
          email: user.email,
        });
      }

      scope.setContext('http', {
        method: request.method,
        url: request.url,
        headers: {
          'user-agent': request.headers['user-agent'],
        },
      });
    });

    return next.handle().pipe(
      tap({
        error: (error) => {
          if (this.shouldCaptureError(error)) {
            Sentry.captureException(error, {
              extra: {
                url: request.url,
                method: request.method,
                body: request.body,
              },
            });
          }
        },
      }),
    );
  }

  /**
   * Determine if an error should be captured
   * Skip 4xx errors (user errors), only capture 5xx (server errors)
   */
  private shouldCaptureError(error: unknown): boolean {
    if (!(error instanceof Error)) return true;

    const message = error.message?.toLowerCase() || '';

    // Skip common client errors
    const clientErrors = [
      'unauthorized',
      'unauthenticated',
      'forbidden',
      'not found',
      'bad request',
      'validation',
      'invalid',
    ];

    return !clientErrors.some((keyword) => message.includes(keyword));
  }
}

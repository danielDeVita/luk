import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, tap } from 'rxjs';
import * as Sentry from '@sentry/node';
import { Request } from 'express';

/**
 * Type definitions for GraphQL info object
 */
interface GraphQLParentType {
  name?: string;
}

interface GraphQLPath {
  key: string | number;
  prev?: GraphQLPath;
  typename?: string;
}

interface GraphQLInfo {
  fieldName?: string;
  parentType?: GraphQLParentType;
  path?: GraphQLPath;
}

/**
 * Type for authenticated user attached to request
 */
interface AuthenticatedUser {
  id: string;
  email: string;
}

/**
 * Type guard to check if a value is an AuthenticatedUser
 */
function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value &&
    typeof (value as AuthenticatedUser).id === 'string' &&
    typeof (value as AuthenticatedUser).email === 'string'
  );
}

/**
 * Type for HTTP request with optional user
 */
interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Type for GraphQL context
 */
interface GqlContext {
  req?: AuthenticatedRequest;
}

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
    const info = gqlContext.getInfo<GraphQLInfo>();
    const gqlCtx = gqlContext.getContext<GqlContext>();
    const req = gqlCtx.req;
    const user = req?.user;

    const fieldName = info?.fieldName ?? 'unknown';
    const parentTypeName = info?.parentType?.name ?? 'unknown';

    // Set Sentry context
    Sentry.withScope((scope) => {
      // User context
      if (isAuthenticatedUser(user)) {
        scope.setUser({
          id: user.id,
          email: user.email,
        });
      }

      // GraphQL operation context
      scope.setContext('graphql', {
        operationName: fieldName,
        operationType: parentTypeName,
        path: info?.path,
      });

      // Add operation as a tag for filtering
      scope.setTag('graphql.operation', fieldName);
      scope.setTag('graphql.type', parentTypeName);
    });

    return next.handle().pipe(
      tap({
        error: (error: unknown) => {
          // Only capture 5xx-like errors
          if (this.shouldCaptureError(error)) {
            Sentry.captureException(error, {
              extra: {
                operationName: fieldName,
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
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    const method = request.method;
    const url = request.url;
    const userAgent = request.headers['user-agent'];
    const body: unknown = request.body;

    Sentry.withScope((scope) => {
      if (isAuthenticatedUser(user)) {
        scope.setUser({
          id: user.id,
          email: user.email,
        });
      }

      scope.setContext('http', {
        method,
        url,
        headers: {
          'user-agent': userAgent,
        },
      });
    });

    return next.handle().pipe(
      tap({
        error: (error: unknown) => {
          if (this.shouldCaptureError(error)) {
            Sentry.captureException(error, {
              extra: {
                url,
                method,
                body,
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

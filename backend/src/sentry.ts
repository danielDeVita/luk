import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

/**
 * Initialize Sentry for error tracking and performance monitoring.
 * Call this FIRST in main.ts, before any other imports.
 *
 * If SENTRY_DSN is not configured, Sentry is gracefully disabled.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.log('[Sentry] DSN not configured, error tracking disabled');
    return;
  }

  const environment = process.env.NODE_ENV || 'development';
  const release = process.env.SENTRY_RELEASE || process.env.npm_package_version || 'unknown';

  Sentry.init({
    dsn,
    environment,
    release,

    // Performance monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    profilesSampleRate: environment === 'production' ? 0.1 : 1.0,

    integrations: [
      // Performance profiling
      nodeProfilingIntegration(),
      // Prisma integration for database query tracking
      Sentry.prismaIntegration(),
      // GraphQL integration
      Sentry.graphqlIntegration({
        ignoreResolveSpans: false,
        ignoreTrivialResolveSpans: true,
      }),
    ],

    // Filter out expected errors
    beforeSend(event, hint) {
      const error = hint.originalException;

      // Don't send 4xx errors (user errors like validation, not found, etc.)
      if (error instanceof Error) {
        const message = error.message?.toLowerCase() || '';

        // Skip common user errors
        if (
          message.includes('unauthorized') ||
          message.includes('bad request') ||
          message.includes('not found') ||
          message.includes('forbidden') ||
          message.includes('validation failed')
        ) {
          return null;
        }
      }

      return event;
    },

    // Additional context
    initialScope: {
      tags: {
        service: 'raffle-backend',
      },
    },
  });

  console.log(`[Sentry] Initialized (env: ${environment}, release: ${release})`);
}

/**
 * Capture an exception with additional context
 */
export function captureException(
  error: Error,
  context?: {
    user?: { id: string; email?: string };
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  },
): void {
  if (!process.env.SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    if (context?.user) {
      scope.setUser(context.user);
    }
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    Sentry.captureException(error);
  });
}

/**
 * Set the current user context for Sentry
 */
export function setUser(user: { id: string; email?: string; role?: string } | null): void {
  if (!process.env.SENTRY_DSN) return;

  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  } else {
    Sentry.setUser(null);
  }
}

export { Sentry };

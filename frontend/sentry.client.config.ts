import * as Sentry from '@sentry/nextjs';
import { getSentryUserFromAuthStorage } from './src/lib/sentry-auth-context';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    integrations: [
      Sentry.browserTracingIntegration(),
    ],

    // Ignore common client-side errors
    ignoreErrors: [
      // Browser extensions and third-party scripts
      'ResizeObserver loop',
      'ResizeObserver loop limit exceeded',
      'Non-Error exception captured',
      'Non-Error promise rejection captured',

      // Network issues
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      'NetworkError',
      'ChunkLoadError',

      // User-initiated navigation
      'AbortError',
      'The operation was aborted',

      // Common third-party errors
      'fb_xd_fragment',
      'Script error',
    ],

    // Attach user context from persisted auth storage
    beforeSend(event) {
      const user = getSentryUserFromAuthStorage();
      if (user) {
        event.user = {
          id: user.id,
          email: user.email,
        };
      }

      return event;
    },

    // Additional context
    initialScope: {
      tags: {
        service: 'luk-frontend',
      },
    },
  });
}

export {};

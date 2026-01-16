import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session replay for debugging
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
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

    // Attach user context from localStorage token
    beforeSend(event) {
      if (typeof window !== 'undefined') {
        try {
          const token = localStorage.getItem('token');
          if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            event.user = {
              id: payload.sub,
              email: payload.email,
            };
          }
        } catch {
          // Invalid token, continue without user context
        }
      }
      return event;
    },

    // Additional context
    initialScope: {
      tags: {
        service: 'raffle-frontend',
      },
    },
  });
}

export {};

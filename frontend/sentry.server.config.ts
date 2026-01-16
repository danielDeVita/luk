import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Server-side specific settings
    integrations: [],

    // Filter out expected errors
    beforeSend(event, hint) {
      const error = hint.originalException;

      if (error instanceof Error) {
        const message = error.message?.toLowerCase() || '';

        // Skip 404 and common client errors
        if (
          message.includes('not found') ||
          message.includes('404') ||
          message.includes('NEXT_NOT_FOUND')
        ) {
          return null;
        }
      }

      return event;
    },

    // Additional context
    initialScope: {
      tags: {
        service: 'raffle-frontend-server',
      },
    },
  });
}

export {};

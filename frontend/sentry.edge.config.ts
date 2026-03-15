import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,

    // Edge runtime has limited features
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Additional context
    initialScope: {
      tags: {
        service: 'luk-frontend-edge',
      },
    },
  });
}

export {};

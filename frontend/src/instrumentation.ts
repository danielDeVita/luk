export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export const onRequestError = async (
  error: Error & { digest?: string },
  request: {
    method: string;
    url: string;
    headers: { [key: string]: string };
  },
  context: { routerKind: string; routeType: string; routePath: string }
) => {
  // Only import Sentry if DSN is configured
  if (!process.env.SENTRY_DSN) return;

  const Sentry = await import('@sentry/nextjs');

  Sentry.captureException(error, {
    extra: {
      request: {
        method: request.method,
        url: request.url,
      },
      context,
    },
  });
};

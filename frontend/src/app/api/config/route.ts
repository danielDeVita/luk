export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LOCAL_DEV_SITE_URL = 'http://localhost:3000';
const LOCAL_DEV_GRAPHQL_URL = 'http://localhost:3001/graphql';
const LOCAL_DEV_GRAPHQL_WS_URL = 'ws://localhost:3001/graphql';
const LOCAL_DEV_BACKEND_URL = 'http://localhost:3001';

function readEnv(name: string, fallback: string): string {
  const rawValue = process.env[name]?.trim();
  return rawValue || fallback;
}

/**
 * GET /api/config
 * Runtime public configuration for the browser.
 *
 * Read from server-side env on every request (force-dynamic), so the same
 * Docker image works across environments without rebuilding Next.js.
 * Only public values are exposed here — never backend secrets.
 */
export async function GET() {
  const graphqlUrl = readEnv(
    'NEXT_PUBLIC_GRAPHQL_URL',
    LOCAL_DEV_GRAPHQL_URL,
  );

  return Response.json(
    {
      siteUrl: readEnv('NEXT_PUBLIC_SITE_URL', LOCAL_DEV_SITE_URL),
      graphqlUrl,
      graphqlWsUrl: readEnv(
        'NEXT_PUBLIC_GRAPHQL_WS_URL',
        toWsUrl(graphqlUrl, LOCAL_DEV_GRAPHQL_WS_URL),
      ),
      backendUrl: readEnv('NEXT_PUBLIC_BACKEND_URL', LOCAL_DEV_BACKEND_URL),
      turnstileEnabled:
        process.env.NEXT_PUBLIC_TURNSTILE_ENABLED?.trim().toLowerCase() ===
        'true',
      turnstileSiteKey:
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null,
      gaMeasurementId:
        process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || null,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}

function toWsUrl(httpUrl: string, fallback: string): string {
  if (httpUrl.startsWith('https://')) {
    return httpUrl.replace('https://', 'wss://');
  }
  if (httpUrl.startsWith('http://')) {
    return httpUrl.replace('http://', 'ws://');
  }
  return fallback;
}

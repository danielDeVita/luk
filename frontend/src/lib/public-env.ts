const LOCAL_DEV_SITE_URL = 'http://localhost:3000';
const LOCAL_DEV_GRAPHQL_URL = 'http://localhost:3001/graphql';

function resolvePublicUrlEnv(
  envName: 'NEXT_PUBLIC_SITE_URL' | 'NEXT_PUBLIC_GRAPHQL_URL',
  localFallback: string,
): string {
  const rawValue = process.env[envName]?.trim();

  if (!rawValue) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required public environment variable: ${envName}`);
    }

    return localFallback;
  }

  try {
    return new URL(rawValue).toString();
  } catch {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Invalid URL in public environment variable: ${envName}`);
    }

    return localFallback;
  }
}

export function getPublicSiteUrl(): string {
  return resolvePublicUrlEnv('NEXT_PUBLIC_SITE_URL', LOCAL_DEV_SITE_URL);
}

export function getPublicGraphqlUrl(): string {
  return resolvePublicUrlEnv('NEXT_PUBLIC_GRAPHQL_URL', LOCAL_DEV_GRAPHQL_URL);
}

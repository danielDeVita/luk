export interface RuntimeConfig {
  siteUrl: string;
  graphqlUrl: string;
  graphqlWsUrl: string;
  backendUrl: string;
  turnstileEnabled: boolean;
  turnstileSiteKey: string | null;
  gaMeasurementId: string | null;
}

const LOCAL_DEV_FALLBACK: RuntimeConfig = {
  siteUrl: 'http://localhost:3000',
  graphqlUrl: 'http://localhost:3001/graphql',
  graphqlWsUrl: 'ws://localhost:3001/graphql',
  backendUrl: 'http://localhost:3001',
  turnstileEnabled: false,
  turnstileSiteKey: null,
  gaMeasurementId: null,
};

/**
 * Build-time snapshot (baked NEXT_PUBLIC_* values in the browser,
 * server env during SSR). Used as fallback when /api/config is unreachable.
 */
function buildTimeSnapshot(): RuntimeConfig {
  const graphqlUrl =
    process.env.NEXT_PUBLIC_GRAPHQL_URL?.trim() || LOCAL_DEV_FALLBACK.graphqlUrl;

  return {
    siteUrl:
      process.env.NEXT_PUBLIC_SITE_URL?.trim() || LOCAL_DEV_FALLBACK.siteUrl,
    graphqlUrl,
    graphqlWsUrl:
      process.env.NEXT_PUBLIC_GRAPHQL_WS_URL?.trim() || toWsUrl(graphqlUrl),
    backendUrl:
      process.env.NEXT_PUBLIC_BACKEND_URL?.trim() ||
      LOCAL_DEV_FALLBACK.backendUrl,
    turnstileEnabled:
      process.env.NEXT_PUBLIC_TURNSTILE_ENABLED?.trim().toLowerCase() ===
      'true',
    turnstileSiteKey:
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null,
    gaMeasurementId:
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || null,
  };
}

function toWsUrl(httpUrl: string): string {
  if (httpUrl.startsWith('https://')) {
    return httpUrl.replace('https://', 'wss://');
  }
  if (httpUrl.startsWith('http://')) {
    return httpUrl.replace('http://', 'ws://');
  }
  return LOCAL_DEV_FALLBACK.graphqlWsUrl;
}

function normalizeConfig(data: unknown): RuntimeConfig {
  const fallback = buildTimeSnapshot();
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const record = data as Record<string, unknown>;
  const pickString = (key: string, fallbackValue: string): string => {
    const value = record[key];
    return typeof value === 'string' && value.trim()
      ? value.trim()
      : fallbackValue;
  };

  return {
    siteUrl: pickString('siteUrl', fallback.siteUrl),
    graphqlUrl: pickString('graphqlUrl', fallback.graphqlUrl),
    graphqlWsUrl: pickString('graphqlWsUrl', fallback.graphqlWsUrl),
    backendUrl: pickString('backendUrl', fallback.backendUrl),
    turnstileEnabled:
      typeof record.turnstileEnabled === 'boolean'
        ? record.turnstileEnabled
        : fallback.turnstileEnabled,
    turnstileSiteKey:
      typeof record.turnstileSiteKey === 'string' &&
      record.turnstileSiteKey.trim()
        ? record.turnstileSiteKey.trim()
        : null,
    gaMeasurementId:
      typeof record.gaMeasurementId === 'string' &&
      record.gaMeasurementId.trim()
        ? record.gaMeasurementId.trim()
        : null,
  };
}

let cachedConfig: RuntimeConfig | null = null;
let inflightRequest: Promise<RuntimeConfig> | null = null;

/**
 * Synchronous snapshot of the runtime config.
 * Returns the loaded /api/config values when available,
 * otherwise the build-time fallback. Safe to call during render.
 */
export function getRuntimeConfigSnapshot(): RuntimeConfig {
  return cachedConfig ?? buildTimeSnapshot();
}

/**
 * Load /api/config once (cached). Falls back to build-time values on error,
 * so the app keeps working even if the endpoint fails.
 */
export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }
  if (inflightRequest) {
    return inflightRequest;
  }

  inflightRequest = (async () => {
    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`config endpoint responded ${response.status}`);
      }
      cachedConfig = normalizeConfig(await response.json());
    } catch {
      cachedConfig = buildTimeSnapshot();
    }
    return cachedConfig;
  })();

  return inflightRequest;
}

/** Test-only helper to reset the module cache between tests. */
export function __resetRuntimeConfigForTests(): void {
  cachedConfig = null;
  inflightRequest = null;
}

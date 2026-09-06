import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('GET /api/config', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns local defaults when no public env is set', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_GRAPHQL_URL;
    delete process.env.NEXT_PUBLIC_GRAPHQL_WS_URL;
    delete process.env.NEXT_PUBLIC_BACKEND_URL;
    delete process.env.NEXT_PUBLIC_TURNSTILE_ENABLED;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

    const { GET } = await import('../route');
    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({
      siteUrl: 'http://localhost:3000',
      graphqlUrl: 'http://localhost:3001/graphql',
      graphqlWsUrl: 'ws://localhost:3001/graphql',
      backendUrl: 'http://localhost:3001',
      turnstileEnabled: false,
      turnstileSiteKey: null,
      gaMeasurementId: null,
    });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('exposes runtime env values without leaking secrets', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://app.luk.test';
    process.env.NEXT_PUBLIC_GRAPHQL_URL = 'https://api.luk.test/graphql';
    process.env.NEXT_PUBLIC_BACKEND_URL = 'https://api.luk.test';
    process.env.NEXT_PUBLIC_TURNSTILE_ENABLED = 'true';
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'public-site-key';
    process.env.BACKEND_SECRET_SHOULD_NOT_LEAK = 'super-secret';
    process.env.JWT_SECRET = 'super-secret';

    const { GET } = await import('../route');
    const body = await (await GET()).json();

    expect(body.siteUrl).toBe('https://app.luk.test');
    expect(body.graphqlUrl).toBe('https://api.luk.test/graphql');
    expect(body.graphqlWsUrl).toBe('wss://api.luk.test/graphql');
    expect(body.backendUrl).toBe('https://api.luk.test');
    expect(body.turnstileEnabled).toBe(true);
    expect(body.turnstileSiteKey).toBe('public-site-key');
    expect(JSON.stringify(body)).not.toContain('super-secret');
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  __resetRuntimeConfigForTests,
  getRuntimeConfigSnapshot,
  loadRuntimeConfig,
} from '../runtime-config';

describe('runtime-config', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    __resetRuntimeConfigForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    __resetRuntimeConfigForTests();
  });

  it('fetches /api/config once and caches the result', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        siteUrl: 'https://app.luk.test',
        graphqlUrl: 'https://api.luk.test/graphql',
        graphqlWsUrl: 'wss://api.luk.test/graphql',
        backendUrl: 'https://api.luk.test',
        turnstileEnabled: false,
        turnstileSiteKey: null,
        gaMeasurementId: null,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await loadRuntimeConfig();
    const second = await loadRuntimeConfig();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.backendUrl).toBe('https://api.luk.test');
    expect(second).toBe(first);
    expect(getRuntimeConfigSnapshot().backendUrl).toBe(
      'https://api.luk.test',
    );
  });

  it('falls back to build-time values when the endpoint fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );

    const config = await loadRuntimeConfig();

    expect(config.backendUrl).toContain('http');
    expect(config.graphqlUrl).toContain('/graphql');
    expect(getRuntimeConfigSnapshot()).toEqual(config);
  });
});

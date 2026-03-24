import { afterEach, describe, expect, it } from 'vitest';
import { getSentryUserFromAuthStorage } from '../sentry-auth-context';

describe('getSentryUserFromAuthStorage', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns undefined when auth storage is missing', () => {
    expect(getSentryUserFromAuthStorage()).toBeUndefined();
  });

  it('returns the persisted auth user when available', () => {
    window.localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: {
          user: {
            id: 'user-123',
            email: 'qa@test.com',
          },
        },
      }),
    );

    expect(getSentryUserFromAuthStorage()).toEqual({
      id: 'user-123',
      email: 'qa@test.com',
    });
  });

  it('returns undefined for invalid auth storage payloads', () => {
    window.localStorage.setItem('auth-storage', '{invalid json');

    expect(getSentryUserFromAuthStorage()).toBeUndefined();
  });
});

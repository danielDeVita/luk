const AUTH_STORAGE_KEY = 'auth-storage';

interface StoredAuthUser {
  id?: string;
  email?: string;
}

interface StoredAuthState {
  state?: {
    user?: StoredAuthUser | null;
  };
}

/**
 * Read the persisted auth user from localStorage for Sentry enrichment.
 * This keeps the browser config decoupled from Zustand internals.
 */
export function getSentryUserFromAuthStorage():
  | { id?: string; email?: string }
  | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    const rawStorage = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!rawStorage) {
      return undefined;
    }

    const parsedStorage = JSON.parse(rawStorage) as StoredAuthState;
    const storedUser = parsedStorage.state?.user;

    if (!storedUser?.id && !storedUser?.email) {
      return undefined;
    }

    return {
      id: storedUser.id,
      email: storedUser.email,
    };
  } catch {
    return undefined;
  }
}

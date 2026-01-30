import { ApolloClient, InMemoryCache, from, Observable, FetchResult } from '@apollo/client';
import { BatchHttpLink } from '@apollo/client/link/batch-http';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import * as Sentry from '@sentry/nextjs';
import { useAuthStore } from '@/store/auth';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:3001/graphql';

// Token expiry buffer - refresh 2 minutes before expiry
const TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 1000;

/**
 * Decode JWT payload without verification (just to check expiry)
 */
const decodeJwtPayload = (token: string): { exp?: number } | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
};

/**
 * Check if token is expired or about to expire
 */
const isTokenExpiringSoon = (token: string): boolean => {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true; // If can't decode, treat as expired
  const expiryTime = payload.exp * 1000; // Convert to milliseconds
  return Date.now() >= expiryTime - TOKEN_REFRESH_BUFFER_MS;
};

// Track if we're currently refreshing to prevent multiple refresh calls
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;
let pendingRequests: (() => void)[] = [];

const resolvePendingRequests = () => {
  pendingRequests.forEach((callback) => callback());
  pendingRequests = [];
};

/**
 * Perform the actual refresh token request
 */
const doRefreshToken = async (): Promise<boolean> => {
  try {
    const storedRefreshToken = useAuthStore.getState().refreshToken;

    if (!storedRefreshToken) {
      console.warn('[Auth] No refresh token available');
      return false;
    }

    console.log('[Auth] Refreshing access token...');
    const response = await fetch(`${BACKEND_URL}/auth/refresh`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${storedRefreshToken}`,
      },
    });

    if (!response.ok) {
      console.warn('[Auth] Refresh failed with status:', response.status);
      return false;
    }

    const data = await response.json();
    if (data.token) {
      useAuthStore.getState().setTokens(data.token, data.refreshToken);
      console.log('[Auth] Token refreshed successfully');
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Auth] Refresh error:', error);
    return false;
  }
};

/**
 * Get or create a refresh token promise (singleton pattern)
 * This ensures all concurrent requests wait for the same refresh
 */
const getOrCreateRefreshPromise = (): Promise<boolean> => {
  if (!refreshPromise) {
    isRefreshing = true;
    refreshPromise = doRefreshToken().finally(() => {
      isRefreshing = false;
      refreshPromise = null;
      resolvePendingRequests();
    });
  }
  return refreshPromise;
};

/**
 * Refresh token - waits for any ongoing refresh or starts a new one
 */
const refreshToken = async (): Promise<boolean> => {
  return getOrCreateRefreshPromise();
};

// Auth link - adds Authorization header from localStorage token
// (httpOnly cookies don't work with third-party cookie blocking on different subdomains)
// Also proactively refreshes token if it's about to expire
const authLink = setContext(async (_, { headers }) => {
  // Get token from Zustand store (works outside React components)
  let token = useAuthStore.getState().token;
  const storedRefreshToken = useAuthStore.getState().refreshToken;

  // Proactively refresh if token is about to expire
  if (token && storedRefreshToken && isTokenExpiringSoon(token)) {
    // Wait for refresh (all concurrent requests share the same promise)
    const success = await refreshToken();
    if (success) {
      token = useAuthStore.getState().token; // Get the new token
    }
  } else if (isRefreshing && refreshPromise) {
    // If another request is refreshing, wait for it
    await refreshPromise;
    token = useAuthStore.getState().token;
  }

  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
});

// Batch HTTP link - combines multiple GraphQL queries into a single HTTP request
// This reduces network overhead and improves performance
const batchLink = new BatchHttpLink({
  uri: GRAPHQL_URL,
  credentials: 'include', // Keep for cookie fallback
  batchMax: 10, // Max queries per batch
  batchInterval: 20, // Wait 20ms to collect queries before sending
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }: any) => {
  // Report GraphQL errors to Sentry (only server errors, not user errors)
  if (graphQLErrors) {
    graphQLErrors.forEach((err: { message: string; extensions?: { code?: string } }) => {
      // Skip user-caused errors
      const code = err.extensions?.code;
      if (code !== 'BAD_USER_INPUT' && code !== 'UNAUTHENTICATED' && code !== 'FORBIDDEN') {
        Sentry.captureException(new Error(err.message), {
          extra: {
            operationName: operation.operationName,
            variables: operation.variables,
            extensions: err.extensions,
          },
          tags: {
            type: 'graphql_error',
          },
        });
      }
    });
  }

  // Report network errors to Sentry
  if (networkError) {
    Sentry.captureException(networkError, {
      extra: {
        operationName: operation.operationName,
      },
      tags: {
        type: 'network_error',
      },
    });
  }

  // Check for authentication errors (JWT expired, invalid token, unauthorized)
  const isAuthError = graphQLErrors?.some(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (err: any) => {
      const code = err.extensions?.code;
      const message = err.message?.toLowerCase() || '';
      return (
        code === 'UNAUTHENTICATED' ||
        message.includes('unauthorized') ||
        message.includes('jwt expired') ||
        message.includes('invalid token') ||
        message.includes('jwt malformed') ||
        message.includes('no authorization')
      );
    }
  ) || (networkError?.statusCode === 401);

  if (isAuthError && typeof window !== 'undefined') {
    // Return an Observable that handles the token refresh
    return new Observable<FetchResult>((observer) => {
      // Use the shared refresh function (handles concurrent requests)
      refreshToken().then((success) => {
        if (success) {
          // Token was refreshed - retry the request with new token
          // The authLink will pick up the new token from the store
          forward(operation).subscribe({
            next: observer.next.bind(observer),
            error: observer.error.bind(observer),
            complete: observer.complete.bind(observer),
          });
        } else {
          // Refresh failed - clear auth state and redirect to login
          console.warn('[Auth] Refresh failed, redirecting to login');
          useAuthStore.setState({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
          });
          if (!window.location.pathname.includes('/auth')) {
            window.location.href = '/auth/login';
          }
          // Complete the observable without error to prevent error toasts
          observer.complete();
        }
      });
    });
  }
});

export const client = new ApolloClient({
  link: from([errorLink, authLink, batchLink]), // authLink adds Authorization header
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});

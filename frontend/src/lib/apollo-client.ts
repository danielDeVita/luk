import { ApolloClient, InMemoryCache, from, Observable, FetchResult } from '@apollo/client';
import { BatchHttpLink } from '@apollo/client/link/batch-http';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import * as Sentry from '@sentry/nextjs';
import { useAuthStore } from '@/store/auth';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:3001/graphql';

// Track if we're currently refreshing to prevent multiple refresh calls
let isRefreshing = false;
let pendingRequests: (() => void)[] = [];

const resolvePendingRequests = () => {
  pendingRequests.forEach((callback) => callback());
  pendingRequests = [];
};

const refreshToken = async (): Promise<boolean> => {
  try {
    // Use refresh token from store (not access token) for the refresh endpoint
    const storedRefreshToken = useAuthStore.getState().refreshToken;

    if (!storedRefreshToken) {
      return false;
    }

    const response = await fetch(`${BACKEND_URL}/auth/refresh`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        // Send refresh token via Authorization header (cross-subdomain support)
        Authorization: `Bearer ${storedRefreshToken}`,
      },
    });

    if (!response.ok) {
      return false;
    }

    // Backend returns new access token (and optionally new refresh token)
    const data = await response.json();
    if (data.token) {
      useAuthStore.getState().setTokens(data.token, data.refreshToken);
    }
    return true;
  } catch {
    return false;
  }
};

// Auth link - adds Authorization header from localStorage token
// (httpOnly cookies don't work with third-party cookie blocking on different subdomains)
const authLink = setContext((_, { headers }) => {
  // Get token from Zustand store (works outside React components)
  const token = useAuthStore.getState().token;

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

  // Check for authentication errors
  const isAuthError = graphQLErrors?.some(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (err: any) => err.extensions?.code === 'UNAUTHENTICATED' || err.message?.includes('Unauthorized')
  ) || (networkError?.statusCode === 401);

  if (isAuthError && typeof window !== 'undefined') {
    // Return an Observable that handles the token refresh
    return new Observable<FetchResult>((observer) => {
      const handleRefresh = async () => {
        // If already refreshing, queue this request
        if (isRefreshing) {
          return new Promise<boolean>((resolve) => {
            pendingRequests.push(() => resolve(true));
          });
        }

        isRefreshing = true;
        try {
          const success = await refreshToken();
          resolvePendingRequests();
          return success;
        } finally {
          isRefreshing = false;
        }
      };

      handleRefresh().then((success) => {
        if (success) {
          // Token was refreshed (new cookie set by backend)
          // Retry the request - cookies will be sent automatically
          forward(operation).subscribe({
            next: observer.next.bind(observer),
            error: observer.error.bind(observer),
            complete: observer.complete.bind(observer),
          });
        } else {
          // Refresh failed - redirect to login
          if (!window.location.pathname.includes('/auth')) {
            window.location.href = '/auth/login';
          }
          observer.error(new Error('Session expired'));
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

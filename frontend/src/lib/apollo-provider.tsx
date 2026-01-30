'use client';

import { ApolloClient, InMemoryCache, createHttpLink, split, from, Observable, FetchResult } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient, Client } from 'graphql-ws';
import { useAuthStore } from '@/store/auth';
import { ReactNode, useMemo, createContext, useContext, useState, useEffect, useCallback } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

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

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface ConnectionContextType {
  status: ConnectionStatus;
  retryConnection: () => void;
}

const ConnectionContext = createContext<ConnectionContextType>({
  status: 'connecting',
  retryConnection: () => {},
});

export function useConnectionStatus() {
  return useContext(ConnectionContext);
}

function toWsUrl(httpUrl: string) {
  if (httpUrl.startsWith('https://')) return httpUrl.replace('https://', 'wss://');
  if (httpUrl.startsWith('http://')) return httpUrl.replace('http://', 'ws://');
  return httpUrl;
}

interface ApolloClientWithWs {
  client: ApolloClient;
  wsClient: Client | null;
}

function createApolloClient(
  isAuthenticated: boolean,
  onStatusChange: (status: ConnectionStatus) => void
): ApolloClientWithWs {
  const httpUri = process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:3001/graphql';
  const wsUri = process.env.NEXT_PUBLIC_GRAPHQL_WS_URL || toWsUrl(httpUri);

  // Auth link - adds Authorization header from localStorage token
  // Also proactively refreshes token if it's about to expire
  const authLink = setContext(async (_, { headers }) => {
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

  // HTTP link with credentials
  const httpLink = createHttpLink({
    uri: httpUri,
    credentials: 'include', // Keep for cookie fallback
  });

  // Track WebSocket client for connection management
  let wsClient: Client | null = null;

  // Only create WebSocket in browser environment
  let wsLink: GraphQLWsLink | null = null;
  if (typeof window !== 'undefined') {
    wsClient = createClient({
      url: wsUri,
      // WebSocket doesn't support cookies, but we can use it for subscriptions
      // after the user is authenticated via HTTP
      connectionParams: () => ({}),
      // Retry configuration for resilient connections
      retryAttempts: 5,
      retryWait: async (retries) => {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        const delay = Math.min(1000 * Math.pow(2, retries), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
      },
      on: {
        connecting: () => {
          onStatusChange('connecting');
        },
        connected: () => {
          onStatusChange('connected');
        },
        closed: () => {
          onStatusChange('disconnected');
        },
        error: () => {
          onStatusChange('error');
        },
      },
      // Lazy connection - only connect when needed
      lazy: true,
      // Keep connection alive
      keepAlive: 10000,
    });

    wsLink = new GraphQLWsLink(wsClient);
  }

  // Error link - handles auth errors with token refresh and retry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errorLink = onError(({ graphQLErrors, networkError, operation, forward }: any) => {
    if (graphQLErrors?.length) {
      console.error('[GraphQL Error]', graphQLErrors.map((e: { message: string }) => e.message).join('\n'));
    }

    if (networkError) {
      console.error('[Network Error]', networkError.message);
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

  // Combine auth link with http link
  const authedHttpLink = authLink.concat(httpLink);

  // Use split link only if wsLink is available (browser environment)
  const terminalLink = wsLink
    ? split(
        ({ query }) => {
          const definition = getMainDefinition(query);
          return (
            definition.kind === 'OperationDefinition' &&
            definition.operation === 'subscription'
          );
        },
        wsLink,
        authedHttpLink,
      )
    : authedHttpLink;

  const client = new ApolloClient({
    link: from([errorLink, terminalLink]),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-and-network',
      },
    },
  });

  return { client, wsClient };
}

export function ApolloWrapper({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [retryTrigger, setRetryTrigger] = useState(0);

  const { client, wsClient } = useMemo(
    () => createApolloClient(isAuthenticated, setConnectionStatus),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAuthenticated, retryTrigger]
  );

  const retryConnection = useCallback(() => {
    if (wsClient) {
      // Terminate existing connection and recreate
      wsClient.terminate();
    }
    setRetryTrigger(prev => prev + 1);
  }, [wsClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsClient) {
        wsClient.terminate();
      }
    };
  }, [wsClient]);

  const contextValue = useMemo(
    () => ({ status: connectionStatus, retryConnection }),
    [connectionStatus, retryConnection]
  );

  return (
    <ConnectionContext.Provider value={contextValue}>
      <ApolloProvider client={client}>
        {children}
      </ApolloProvider>
    </ConnectionContext.Provider>
  );
}

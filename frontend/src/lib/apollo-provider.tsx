'use client';

import { ApolloClient, InMemoryCache, createHttpLink, split, from } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient, Client } from 'graphql-ws';
import { useAuthStore } from '@/store/auth';
import { ReactNode, useMemo, createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

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
  const authLink = setContext((_, { headers }) => {
    const token = useAuthStore.getState().token;
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

  const errorLink = onError((err: unknown) => {
    const errorObj = err as { graphQLErrors?: Array<{ message: string }>; networkError?: Error };
    const graphQLErrors = errorObj?.graphQLErrors;
    const networkError = errorObj?.networkError;

    if (graphQLErrors?.length) {
      const message = graphQLErrors.map((e) => e.message).join('\n');
      toast.error(message);
    }

    if (networkError) {
      toast.error('No se pudo conectar con el servidor.');
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

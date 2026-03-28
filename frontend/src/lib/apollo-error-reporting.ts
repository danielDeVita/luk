import * as Sentry from '@sentry/nextjs';

type GraphQLErrorLike = {
  message?: string;
  extensions?: {
    code?: string;
    [key: string]: unknown;
  };
};

type NetworkErrorLike = Error & {
  statusCode?: number;
  response?: {
    status?: number;
  };
};

type ApolloErrorReportingInput = {
  operationName?: string;
  route?: string;
  user?: {
    id: string;
    email?: string;
  } | null;
  graphQLErrors?: GraphQLErrorLike[];
  networkError?: NetworkErrorLike | null;
};

const IGNORED_GRAPHQL_CODES = new Set([
  'BAD_USER_INPUT',
  'FORBIDDEN',
  'UNAUTHENTICATED',
  'NOT_FOUND',
]);

function getNetworkStatusCode(
  networkError: ApolloErrorReportingInput['networkError'],
): number | undefined {
  if (!networkError) return undefined;

  if (typeof networkError.statusCode === 'number') {
    return networkError.statusCode;
  }

  if (typeof networkError.response?.status === 'number') {
    return networkError.response.status;
  }

  return undefined;
}

export function shouldReportGraphQLError(error: GraphQLErrorLike): boolean {
  const code = error.extensions?.code;
  if (!code) return false;
  if (IGNORED_GRAPHQL_CODES.has(code)) return false;
  return code === 'INTERNAL_SERVER_ERROR';
}

export function shouldReportNetworkError(
  networkError: ApolloErrorReportingInput['networkError'],
): boolean {
  const statusCode = getNetworkStatusCode(networkError);
  if (statusCode === 401) return false;
  if (typeof statusCode === 'number') {
    return statusCode >= 500;
  }

  return Boolean(networkError);
}

function captureApolloException(
  error: Error,
  context: {
    operationName?: string;
    route?: string;
    graphqlCode?: string;
    statusCode?: number;
    user?: ApolloErrorReportingInput['user'];
  },
) {
  Sentry.withScope((scope) => {
    scope.setTag('source', 'apollo');

    if (context.operationName) {
      scope.setTag('operationName', context.operationName);
      scope.setExtra('operationName', context.operationName);
    }

    if (context.route) {
      scope.setExtra('route', context.route);
    }

    if (context.graphqlCode) {
      scope.setTag('graphqlCode', context.graphqlCode);
      scope.setExtra('graphqlCode', context.graphqlCode);
    }

    if (typeof context.statusCode === 'number') {
      scope.setTag('statusCode', String(context.statusCode));
      scope.setExtra('statusCode', context.statusCode);
    }

    if (context.user) {
      scope.setUser({
        id: context.user.id,
        email: context.user.email,
      });
    }

    Sentry.captureException(error);
  });
}

export function reportApolloOperationalErrors({
  operationName,
  route,
  user,
  graphQLErrors,
  networkError,
}: ApolloErrorReportingInput): void {
  for (const graphQLError of graphQLErrors ?? []) {
    if (!shouldReportGraphQLError(graphQLError)) {
      continue;
    }

    captureApolloException(
      new Error(graphQLError.message || 'GraphQL internal server error'),
      {
        operationName,
        route,
        graphqlCode: graphQLError.extensions?.code,
        user,
      },
    );
  }

  if (!shouldReportNetworkError(networkError)) {
    return;
  }

  const statusCode = getNetworkStatusCode(networkError);
  captureApolloException(
    networkError instanceof Error
      ? networkError
      : new Error('Apollo network error'),
    {
      operationName,
      route,
      statusCode,
      user,
    },
  );
}

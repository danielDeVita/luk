import { toast } from 'sonner';

interface GraphQLErrorExtensions {
  code?: string;
  [key: string]: unknown;
}

interface GraphQLErrorLike {
  graphQLErrors?: Array<{
    message: string;
    extensions?: GraphQLErrorExtensions;
  }>;
  networkError?: Error | null;
  message?: string;
}

// User-friendly messages for GraphQL error codes
const ERROR_CODE_MESSAGES: Record<string, string> = {
  'UNAUTHENTICATED': 'Tu sesión expiró. Por favor, inicia sesión nuevamente.',
  'FORBIDDEN': 'No tienes permiso para realizar esta acción.',
  'NOT_FOUND': 'El recurso solicitado no existe.',
  'BAD_REQUEST': 'Los datos enviados no son válidos.',
  'BAD_USER_INPUT': 'Los datos ingresados no son válidos. Verificá los campos.',
  'INTERNAL_SERVER_ERROR': 'Error del servidor. Intentá de nuevo más tarde.',
  'GRAPHQL_VALIDATION_FAILED': 'Error de validación. Verificá los datos ingresados.',
  'PERSISTED_QUERY_NOT_FOUND': 'Error de consulta. Recargá la página e intentá de nuevo.',
};

function isGraphQLError(error: unknown): error is GraphQLErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('graphQLErrors' in error || 'networkError' in error)
  );
}

/**
 * Centralized error handler for consistent error messaging throughout the app.
 * Extracts meaningful messages from various error types and displays them via toast.
 */
export function handleError(error: unknown, fallbackMessage = 'Algo salió mal'): void {
  const message = getErrorMessage(error, fallbackMessage);
  toast.error(message);
}

/**
 * Extracts a user-friendly error message from various error types.
 */
export function getErrorMessage(error: unknown, fallbackMessage = 'Algo salió mal'): string {
  if (isGraphQLError(error)) {
    // Check for error code first
    const gqlError = error.graphQLErrors?.[0];
    const errorCode = gqlError?.extensions?.code as string | undefined;

    if (errorCode && ERROR_CODE_MESSAGES[errorCode]) {
      return ERROR_CODE_MESSAGES[errorCode];
    }

    // Fallback to error message
    const gqlMessage = gqlError?.message;
    if (gqlMessage) return gqlMessage;

    // Network errors
    if (error.networkError) {
      return 'Error de conexión. Verificá tu internet e intentá de nuevo.';
    }

    return error.message || fallbackMessage;
  }

  if (error instanceof Error) {
    // Handle fetch/network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return 'Error de conexión. Verificá tu internet e intentá de nuevo.';
    }
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return fallbackMessage;
}

/**
 * Shows a success toast with the given message.
 */
export function showSuccess(message: string): void {
  toast.success(message);
}

/**
 * Shows an info toast with the given message.
 */
export function showInfo(message: string): void {
  toast.info(message);
}

/**
 * Shows a warning toast with the given message.
 */
export function showWarning(message: string): void {
  toast.warning(message);
}

/**
 * Formats an Apollo GraphQL error for display.
 * Specifically typed for ApolloError but works with any GraphQL error.
 */
export function formatGraphQLError(error: GraphQLErrorLike): string {
  return getErrorMessage(error);
}

/**
 * Checks if an error is an authentication error that requires login.
 */
export function isAuthError(error: unknown): boolean {
  if (!isGraphQLError(error)) return false;

  const errorCode = error.graphQLErrors?.[0]?.extensions?.code;
  return errorCode === 'UNAUTHENTICATED';
}

/**
 * Checks if an error is a permission/authorization error.
 */
export function isForbiddenError(error: unknown): boolean {
  if (!isGraphQLError(error)) return false;

  const errorCode = error.graphQLErrors?.[0]?.extensions?.code;
  return errorCode === 'FORBIDDEN';
}

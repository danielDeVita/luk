import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/nextjs';
import {
  reportApolloOperationalErrors,
  shouldReportGraphQLError,
  shouldReportNetworkError,
} from '../apollo-error-reporting';

vi.mock('@sentry/nextjs', () => ({
  withScope: vi.fn(),
  captureException: vi.fn(),
}));

describe('apollo error reporting', () => {
  const setTag = vi.fn();
  const setExtra = vi.fn();
  const setUser = vi.fn();

  beforeEach(() => {
    vi.mocked(Sentry.withScope).mockImplementation((callback) => {
      callback({
        setTag,
        setExtra,
        setUser,
      });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reports GraphQL INTERNAL_SERVER_ERROR to Sentry', () => {
    reportApolloOperationalErrors({
      operationName: 'GetSalesDashboard',
      route: '/dashboard/sales',
      user: { id: 'user-1', email: 'qa@test.com' },
      graphQLErrors: [
        {
          message: 'Internal server error',
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        },
      ],
    });

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(setTag).toHaveBeenCalledWith('graphqlCode', 'INTERNAL_SERVER_ERROR');
    expect(setExtra).toHaveBeenCalledWith('operationName', 'GetSalesDashboard');
    expect(setExtra).toHaveBeenCalledWith('route', '/dashboard/sales');
    expect(setUser).toHaveBeenCalledWith({
      id: 'user-1',
      email: 'qa@test.com',
    });
  });

  it('reports 5xx network errors to Sentry', () => {
    const networkError = Object.assign(new Error('Gateway timeout'), {
      statusCode: 503,
    });

    reportApolloOperationalErrors({
      operationName: 'GetSalesDashboard',
      route: '/dashboard/sales',
      networkError,
    });

    expect(Sentry.captureException).toHaveBeenCalledWith(networkError);
    expect(setTag).toHaveBeenCalledWith('statusCode', '503');
  });

  it('does not report expected user-facing GraphQL or auth errors', () => {
    const unauthorizedError = Object.assign(new Error('Unauthorized'), {
      statusCode: 401,
    });

    reportApolloOperationalErrors({
      graphQLErrors: [
        {
          message: 'Input inválido',
          extensions: { code: 'BAD_USER_INPUT' },
        },
        {
          message: 'No autenticado',
          extensions: { code: 'UNAUTHENTICATED' },
        },
      ],
      networkError: unauthorizedError,
    });

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('filters reportable Apollo errors correctly', () => {
    expect(
      shouldReportGraphQLError({
        message: 'boom',
        extensions: { code: 'INTERNAL_SERVER_ERROR' },
      }),
    ).toBe(true);
    expect(
      shouldReportGraphQLError({
        message: 'bad input',
        extensions: { code: 'BAD_USER_INPUT' },
      }),
    ).toBe(false);
    expect(
      shouldReportNetworkError(
        Object.assign(new Error('Server error'), { statusCode: 500 }),
      ),
    ).toBe(true);
    expect(
      shouldReportNetworkError(
        Object.assign(new Error('Unauthorized'), { statusCode: 401 }),
      ),
    ).toBe(false);
  });
});

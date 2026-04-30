import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { useQuery } from '@apollo/client/react';
import { useRouter, useSearchParams } from 'next/navigation';

vi.unmock('@/store/auth');

import AuthCallbackPage from '../page';
import { useAuthStore } from '@/store/auth';

const { mockGetPublicBackendUrl } = vi.hoisted(() => ({
  mockGetPublicBackendUrl: vi.fn(() => 'http://localhost:3001'),
}));

vi.mock('@apollo/client/react', () => ({
  useQuery: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock('@/lib/public-env', () => ({
  getPublicBackendUrl: mockGetPublicBackendUrl,
}));

describe('AuthCallbackPage', () => {
  const mockUseQuery = vi.mocked(useQuery);
  const mockUseRouter = vi.mocked(useRouter);
  const mockUseSearchParams = vi.mocked(useSearchParams);
  const mockReplace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hasHydrated: true,
    });

    mockUseRouter.mockReturnValue({
      push: vi.fn(),
      replace: mockReplace,
      refresh: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    });
  });

  it('exchanges the OAuth cookie for an access token and completes login', async () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams('success=true') as unknown as ReturnType<
        typeof useSearchParams
      >,
    );

    mockUseQuery.mockImplementation((_, options) => {
      const queryOptions = options as { skip?: boolean } | undefined;

      if (queryOptions?.skip) {
        return {
          data: undefined,
          error: undefined,
          loading: false,
        } as ReturnType<typeof useQuery>;
      }

      return {
        data: {
          me: {
            id: 'user-1',
            email: 'test@example.com',
            nombre: 'Test',
            apellido: 'User',
            role: 'USER',
          },
        },
        error: undefined,
        loading: false,
      } as ReturnType<typeof useQuery>;
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'oauth-access-token' }),
    }) as unknown as Mock;

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/auth/token',
        {
          method: 'GET',
          credentials: 'include',
        },
      );
    });

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user).toEqual(
        expect.objectContaining({ id: 'user-1' }),
      );
      expect(useAuthStore.getState().token).toBe('oauth-access-token');
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  it('redirects to login when the OAuth token exchange fails', async () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams('success=true') as unknown as ReturnType<
        typeof useSearchParams
      >,
    );

    mockUseQuery.mockReturnValue({
      data: undefined,
      error: undefined,
      loading: false,
    } as ReturnType<typeof useQuery>);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    }) as unknown as Mock;

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/auth/login?error=callback_failed',
      );
    });
  });
});

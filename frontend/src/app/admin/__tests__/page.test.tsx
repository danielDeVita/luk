import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client/react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import AdminPage from '../page';

vi.mock('@apollo/client/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useLazyQuery: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/hooks/use-confirm-dialog', () => ({
  useConfirmDialog: () => vi.fn(),
}));

vi.mock('@/components/admin/social-promotion-review', () => ({
  SocialPromotionReview: () => <div data-testid="social-promotion-review" />,
}));

vi.mock('@/components/admin/promotion-grant-reversal-log', () => ({
  PromotionGrantReversalLog: () => <div data-testid="promotion-grant-reversal-log" />,
}));

describe('AdminPage', () => {
  const mockPush = vi.fn();
  const mockUseRouter = vi.mocked(useRouter);
  const mockUseAuthStore = vi.mocked(useAuthStore);
  const mockUseQuery = vi.mocked(useQuery);
  const mockUseMutation = vi.mocked(useMutation);
  const mockUseLazyQuery = vi.mocked(useLazyQuery);

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    });

    mockUseQuery.mockImplementation(() => ({
      data: undefined,
      loading: false,
      error: undefined,
      refetch: vi.fn(),
    }) as unknown as ReturnType<typeof useQuery>);

    mockUseMutation.mockReturnValue([
      vi.fn(),
      { data: undefined, loading: false, error: undefined },
    ] as unknown as ReturnType<typeof useMutation>);

    mockUseLazyQuery.mockReturnValue([
      vi.fn(),
      { data: undefined, loading: false, error: undefined },
    ] as unknown as ReturnType<typeof useLazyQuery>);
  });

  it('does not redirect before auth store hydration finishes', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null,
      hasHydrated: false,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
      setAuth: vi.fn(),
      getToken: vi.fn(),
      getRefreshToken: vi.fn(),
      setTokens: vi.fn(),
      updateUser: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      clearError: vi.fn(),
      setHasHydrated: vi.fn(),
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useAuthStore>);

    render(<AdminPage />);

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ skip: true }),
    );
  });

  it('redirects unauthenticated users after hydration', async () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null,
      hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
      setAuth: vi.fn(),
      getToken: vi.fn(),
      getRefreshToken: vi.fn(),
      setTokens: vi.fn(),
      updateUser: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      clearError: vi.fn(),
      setHasHydrated: vi.fn(),
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useAuthStore>);

    render(<AdminPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/auth/login');
    });
  });

  it('renders the admin panel for hydrated admin sessions', async () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: {
        id: 'admin-1',
        email: 'admin@test.com',
        nombre: 'Admin',
        apellido: 'QA',
        role: 'ADMIN',
      },
      hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
      setAuth: vi.fn(),
      getToken: vi.fn(),
      getRefreshToken: vi.fn(),
      setTokens: vi.fn(),
      updateUser: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      clearError: vi.fn(),
      setHasHydrated: vi.fn(),
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useAuthStore>);

    render(<AdminPage />);

    expect(await screen.findByRole('heading', { name: /panel de administracion/i })).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ skip: false }),
    );
  });
});

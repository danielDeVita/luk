import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client/react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import AdminPage from '../page';

const getOperationText = (operation: unknown) =>
  (operation as { loc?: { source?: { body?: string } } }).loc?.source?.body ??
  '';

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

vi.mock('@/components/admin/social-promotion-analytics', () => ({
  SocialPromotionAnalytics: () => <div data-testid="social-promotion-analytics" />,
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

  const mockAdminSession = () => {
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
  };

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
    mockAdminSession();

    render(<AdminPage />);

    expect(await screen.findByRole('heading', { name: /panel de administracion/i })).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ skip: false }),
    );
  });

  it('shows analytics, review, and reversals inside the social promotions tab', async () => {
    const user = userEvent.setup();

    mockAdminSession();

    render(<AdminPage />);

    await user.click(
      await screen.findByRole('tab', { name: /promoción social/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId('social-promotion-analytics')).toBeInTheDocument();
      expect(screen.getByTestId('social-promotion-review')).toBeInTheDocument();
      expect(
        screen.getByTestId('promotion-grant-reversal-log'),
      ).toBeInTheDocument();
    });
  });

  it('shows admin-only buyer reputation flags in the users tab', async () => {
    const user = userEvent.setup();
    mockAdminSession();
    mockUseQuery.mockImplementation((operation) => {
      const operationText = getOperationText(operation);
      if (operationText.includes('query GetAdminUsers')) {
        return {
          data: {
            adminUsers: {
              total: 1,
              users: [
                {
                  id: 'buyer-1',
                  email: 'buyer@test.com',
                  nombre: 'Buyer',
                  apellido: 'Risk',
                  role: 'USER',
                  mpConnectStatus: 'NOT_CONNECTED',
                  kycStatus: 'NOT_SUBMITTED',
                  createdAt: '2026-04-01T12:00:00.000Z',
                  isDeleted: false,
                  rafflesCreated: 0,
                  ticketsPurchased: 12,
                  rafflesWon: 1,
                  totalTicketsComprados: 60,
                  totalRifasGanadas: 1,
                  totalComprasCompletadas: 2,
                  disputasComoCompradorAbiertas: 2,
                  buyerRiskFlags: ['HIGH_DISPUTE_RATE', 'HEAVY_BUYER'],
                },
              ],
            },
          },
          loading: false,
          error: undefined,
          refetch: vi.fn(),
        } as unknown as ReturnType<typeof useQuery>;
      }
      return {
        data: undefined,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useQuery>;
    });

    render(<AdminPage />);

    await user.click(await screen.findByRole('tab', { name: /usuarios/i }));

    expect((await screen.findAllByText('buyer@test.com')).length).toBeGreaterThan(0);
    expect(screen.getByText(/T:60 W:1 C:2 D:2/)).toBeInTheDocument();
    expect(screen.getAllByText('HIGH_DISPUTE_RATE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('HEAVY_BUYER').length).toBeGreaterThan(0);
  });

  it('lets admin hide a public review comment while preserving the rating', async () => {
    const user = userEvent.setup();
    const hideReviewMutation = vi.fn();
    mockAdminSession();
    mockUseQuery.mockImplementation((operation) => {
      const operationText = getOperationText(operation);
      if (operationText.includes('query GetAdminReviews')) {
        return {
          data: {
            adminReviews: {
              total: 1,
              reviews: [
                {
                  id: 'review-1',
                  rating: 2,
                  comentario: 'Comentario a moderar',
                  createdAt: '2026-04-01T12:00:00.000Z',
                  reviewerName: 'Buyer Risk',
                  reviewerEmail: 'buyer@test.com',
                  sellerName: 'Seller Pro',
                  sellerEmail: 'seller@test.com',
                  raffleTitle: 'MacBook QA',
                  commentHidden: false,
                  commentHiddenReason: null,
                },
              ],
            },
          },
          loading: false,
          error: undefined,
          refetch: vi.fn(),
        } as unknown as ReturnType<typeof useQuery>;
      }
      return {
        data: undefined,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useQuery>;
    });
    mockUseMutation.mockImplementation((operation) => {
      const operationText = getOperationText(operation);
      if (operationText.includes('mutation HideReviewComment')) {
        return [
          hideReviewMutation,
          { data: undefined, loading: false, error: undefined },
        ] as unknown as ReturnType<typeof useMutation>;
      }
      return [
        vi.fn(),
        { data: undefined, loading: false, error: undefined },
      ] as unknown as ReturnType<typeof useMutation>;
    });

    render(<AdminPage />);

    await user.click(await screen.findByRole('tab', { name: /reseñas/i }));
    expect(await screen.findByText('MacBook QA')).toBeInTheDocument();
    expect(screen.getByText('2/5')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /ocultar comentario/i }),
    );
    await user.type(
      screen.getByPlaceholderText(/motivo de moderación/i),
      'Contenido ofensivo',
    );
    const hideButtons = screen.getAllByRole('button', {
      name: /ocultar comentario/i,
    });
    await user.click(hideButtons[hideButtons.length - 1]);

    expect(hideReviewMutation).toHaveBeenCalledWith({
      variables: {
        reviewId: 'review-1',
        reason: 'Contenido ofensivo',
      },
    });
  });
});

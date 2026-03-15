import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMutation, useQuery } from '@apollo/client/react';
import { useAuthStore } from '@/store/auth';
import { RaffleContent } from '../raffle-content';

function createMutationResult() {
  return [
    vi.fn(),
    {
      called: false,
      loading: false,
      data: undefined,
      error: undefined,
      client: {} as never,
      reset: vi.fn(),
    },
  ] as ReturnType<typeof useMutation>;
}

function createQueryResult<TData>(data: TData) {
  return {
    data,
    dataState: 'complete' as const,
    loading: false,
    error: undefined,
    refetch: vi.fn(),
    client: {} as never,
    observable: {} as never,
    networkStatus: 7 as const,
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
    subscribeToMore: vi.fn(),
    updateQuery: vi.fn(),
    fetchMore: vi.fn(),
    variables: {},
    previousData: undefined,
    called: true,
  } as ReturnType<typeof useQuery>;
}

vi.mock('../raffle-qa', () => ({
  RaffleQA: () => <div data-testid="raffle-qa">RaffleQA</div>,
}));

vi.mock('@/components/share/share-buttons', () => ({
  ShareButtons: ({ label = 'Compartir' }: { label?: string }) => (
    <button type="button">{label}</button>
  ),
}));

vi.mock('@/components/social-promotions/social-promotion-manager', () => ({
  SocialPromotionManager: ({
    helperText,
  }: {
    helperText?: string;
  }) => (
    <div>
      <button type="button">Promocionar y medir</button>
      {helperText ? <span>{helperText}</span> : null}
    </div>
  ),
}));

vi.mock('@/components/social-promotions/promotion-bonus-selector', () => ({
  PromotionBonusSelector: () => (
    <div data-testid="promotion-bonus-selector">PromotionBonusSelector</div>
  ),
}));

vi.mock('@/components/ui/countdown', () => ({
  Countdown: () => <div data-testid="countdown">Countdown</div>,
}));

vi.mock('@/components/legal/compliance-notice', () => ({
  ComplianceNotice: () => (
    <div data-testid="compliance-notice">ComplianceNotice</div>
  ),
}));

vi.mock('@/hooks/use-confirm-dialog', () => ({
  useConfirmDialog: () => vi.fn(),
}));

vi.mock('@/lib/cloudinary', () => ({
  getOptimizedImageUrl: (url: string) => url,
  CLOUDINARY_PRESETS: {
    detail: 'detail',
    gallery: 'gallery',
  },
}));

vi.mock('@/lib/format-condition', () => ({
  formatProductCondition: (condition?: string) => condition || 'Nuevo',
}));

vi.mock('@/lib/social-promotions', () => ({
  getStoredSocialPromotionToken: vi.fn(() => null),
  persistSocialPromotionToken: vi.fn(),
}));

describe('RaffleContent', () => {
  const mockUseQuery = vi.mocked(useQuery);
  const mockUseMutation = vi.mocked(useMutation);
  const mockUseAuthStore = vi.mocked(useAuthStore);

  const raffleData = {
    raffle: {
      id: 'raffle-1',
      titulo: 'MacBook Pro',
      descripcion: 'Rifa de prueba',
      totalTickets: 100,
      precioPorTicket: 2500,
      estado: 'ACTIVA',
      fechaLimiteSorteo: '2026-12-31T00:00:00.000Z',
      winnerId: null,
      product: {
        nombre: 'MacBook Pro',
        descripcionDetallada: 'Detalle',
        imagenes: ['https://example.com/macbook.jpg'],
        categoria: 'Tecnologia',
        condicion: 'NUEVO',
      },
      seller: {
        id: 'seller-1',
        nombre: 'Daniel',
        apellido: 'Seller',
        email: 'seller@example.com',
      },
      tickets: [],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseMutation.mockImplementation(() => createMutationResult());
  });

  function mockQueries() {
    mockUseQuery.mockReset();
    mockUseQuery
      .mockReturnValueOnce(createQueryResult(raffleData))
      .mockReturnValueOnce(createQueryResult({ priceHistory: [] }))
      .mockReturnValueOnce(createQueryResult({ mySocialPromotionPosts: [] }))
      .mockReturnValueOnce(createQueryResult({ isFavorite: false }));
  }

  it('replaces the buy form with an informational block for the raffle owner', () => {
    mockQueries();
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      hasHydrated: true,
      user: {
        id: 'seller-1',
        email: 'seller@example.com',
        nombre: 'Daniel',
        apellido: 'Seller',
        role: 'USER',
      },
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
    });

    render(<RaffleContent id="raffle-1" />);

    expect(
      screen.getByText('No podés comprar tickets de tu propia rifa'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /La compra está bloqueada para evitar autocompras/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Comprar 1 Ticket/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Cantidad')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Compartir rápido' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Promocionar y medir' }),
    ).toBeInTheDocument();
  });

  it('keeps the purchase flow visible for a non-owner user', () => {
    mockQueries();
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      hasHydrated: true,
      user: {
        id: 'buyer-1',
        email: 'buyer@example.com',
        nombre: 'Buyer',
        apellido: 'User',
        role: 'USER',
      },
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
    });

    render(<RaffleContent id="raffle-1" />);

    expect(screen.getByText('Comprar Tickets')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Comprar 1 Ticket/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('promotion-bonus-selector'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('No podés comprar tickets de tu propia rifa'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Compartir' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Promocionar y medir' }),
    ).not.toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

function getOperationName(query: unknown) {
  const document = query as {
    definitions?: Array<{ name?: { value?: string } }>;
  };
  return document.definitions?.[0]?.name?.value;
}

async function increaseRandomQuantity(user: ReturnType<typeof userEvent.setup>, clicks: number) {
  const increaseButton = screen.getByRole('button', { name: '+' });

  for (let index = 0; index < clicks; index += 1) {
    await user.click(increaseButton);
  }
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
      winningTicketNumber: null,
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

  const availabilityData = {
    ticketNumberAvailability: {
      items: [
        { number: 1, isAvailable: false },
        { number: 2, isAvailable: true },
        { number: 3, isAvailable: true },
      ],
      totalTickets: 100,
      page: 1,
      pageSize: 100,
      totalPages: 1,
      availableCount: 99,
      maxSelectable: 50,
      premiumPercent: 5,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseMutation.mockImplementation(() => createMutationResult());
  });

  function mockQueries() {
    mockUseQuery.mockReset();
    mockUseQuery.mockImplementation((query, options) => {
      if ((options as { skip?: boolean } | undefined)?.skip) {
        return createQueryResult(undefined as never);
      }

      switch (getOperationName(query)) {
        case 'GetRaffle':
          return createQueryResult(raffleData);
        case 'MyTicketCountInRaffle':
          return createQueryResult({ myTicketCountInRaffle: 0 });
        case 'GetPriceHistory':
          return createQueryResult({ priceHistory: [] });
        case 'MySocialPromotionPosts':
          return createQueryResult({ mySocialPromotionPosts: [] });
        case 'IsFavorite':
          return createQueryResult({ isFavorite: false });
        case 'TicketNumberAvailability':
          return createQueryResult(availabilityData);
        default:
          return createQueryResult(undefined as never);
      }
    });
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
    expect(screen.getByRole('tab', { name: 'Aleatorio' })).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Elegir números' }),
    ).toBeInTheDocument();
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

  it('shows the selected-number flow with premium breakdown and disabled unavailable numbers', async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByRole('tab', { name: 'Elegir números' }));

    expect(
      screen.getByText('Elegí tus números favoritos'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '#1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '#2' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /Comprar números elegidos/i }),
    ).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '#2' }));
    await user.click(screen.getByRole('button', { name: '#3' }));

    expect(screen.getByText('2 números seleccionados')).toBeInTheDocument();
    expect(screen.getByText('Subtotal base')).toBeInTheDocument();
    expect(screen.getByText('Premium por elegir números')).toBeInTheDocument();
    expect(screen.getByText('$5000.00')).toBeInTheDocument();
    expect(screen.getByText('$250.00')).toBeInTheDocument();
    expect(screen.getByText('$5250.00')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Comprar números elegidos/i }),
    ).toBeEnabled();
  });

  it('shows the simple pack summary and hides promotion bonuses when a random pack applies', async () => {
    const user = userEvent.setup();
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

    await increaseRandomQuantity(user, 4);

    expect(
      screen.getByText('Pack activo: pagás 5 y recibís 6 tickets.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Esta compra no se acumula con bonificaciones promocionales.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('promotion-bonus-selector'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Tickets pagados')).toBeInTheDocument();
    expect(screen.getByText('Tickets bonus')).toBeInTheDocument();
    expect(screen.getByText('Total de tickets')).toBeInTheDocument();
    expect(screen.getByText('$15000.00')).toBeInTheDocument();
    expect(screen.getByText('-$2500.00')).toBeInTheDocument();
    expect(screen.getByText('$12500.00')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Comprar 5 y recibir 6/i }),
    ).toBeInTheDocument();
  });

  it('falls back to normal purchase messaging when the pack cannot apply because stock is too low', async () => {
    const user = userEvent.setup();
    mockUseQuery.mockReset();
    mockUseQuery.mockImplementation((query, options) => {
      if ((options as { skip?: boolean } | undefined)?.skip) {
        return createQueryResult(undefined as never);
      }

      switch (getOperationName(query)) {
        case 'GetRaffle':
          return createQueryResult({
            raffle: {
              ...raffleData.raffle,
              tickets: Array.from({ length: 95 }, (_, index) => ({
                id: `ticket-${index + 1}`,
                estado: 'PAGADO',
              })),
            },
          });
        case 'MyTicketCountInRaffle':
          return createQueryResult({ myTicketCountInRaffle: 0 });
        case 'GetPriceHistory':
          return createQueryResult({ priceHistory: [] });
        case 'MySocialPromotionPosts':
          return createQueryResult({ mySocialPromotionPosts: [] });
        case 'IsFavorite':
          return createQueryResult({ isFavorite: false });
        case 'TicketNumberAvailability':
          return createQueryResult(availabilityData);
        default:
          return createQueryResult(undefined as never);
      }
    });
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

    await increaseRandomQuantity(user, 4);

    expect(
      screen.getByText('Quedan pocos tickets, el pack ya no aplica.'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('promotion-bonus-selector'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('$12500.00')).toHaveLength(2);
    expect(screen.queryByText('Tickets bonus')).not.toBeInTheDocument();
  });

  it('falls back to normal purchase messaging when the pack would exceed the buyer cap', async () => {
    const user = userEvent.setup();
    mockUseQuery.mockReset();
    mockUseQuery.mockImplementation((query, options) => {
      if ((options as { skip?: boolean } | undefined)?.skip) {
        return createQueryResult(undefined as never);
      }

      switch (getOperationName(query)) {
        case 'GetRaffle':
          return createQueryResult({
            raffle: {
              ...raffleData.raffle,
              totalTickets: 20,
              tickets: [],
            },
          });
        case 'MyTicketCountInRaffle':
          return createQueryResult({ myTicketCountInRaffle: 0 });
        case 'GetPriceHistory':
          return createQueryResult({ priceHistory: [] });
        case 'MySocialPromotionPosts':
          return createQueryResult({ mySocialPromotionPosts: [] });
        case 'IsFavorite':
          return createQueryResult({ isFavorite: false });
        case 'TicketNumberAvailability':
          return createQueryResult({
            ...availabilityData,
            ticketNumberAvailability: {
              ...availabilityData.ticketNumberAvailability,
              totalTickets: 20,
              maxSelectable: 10,
            },
          });
        default:
          return createQueryResult(undefined as never);
      }
    });
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

    await increaseRandomQuantity(user, 9);

    expect(
      screen.getByText(
        'El pack no aplica porque superarías el máximo permitido para esta rifa.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('promotion-bonus-selector'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('$25000.00')).toHaveLength(2);
  });

  it('hides the countdown and shows the winning number once the raffle is drawn', () => {
    mockUseQuery.mockReset();
    mockUseQuery.mockImplementation((query, options) => {
      if ((options as { skip?: boolean } | undefined)?.skip) {
        return createQueryResult(undefined as never);
      }

      switch (getOperationName(query)) {
        case 'GetRaffle':
          return createQueryResult({
            raffle: {
              ...raffleData.raffle,
              estado: 'SORTEADA',
              winnerId: 'winner-1',
              winningTicketNumber: 17,
            },
          });
        case 'GetPriceHistory':
          return createQueryResult({ priceHistory: [] });
        case 'MySocialPromotionPosts':
          return createQueryResult({ mySocialPromotionPosts: [] });
        case 'IsFavorite':
          return createQueryResult({ isFavorite: false });
        case 'TicketNumberAvailability':
          return createQueryResult(availabilityData);
        default:
          return createQueryResult(undefined as never);
      }
    });
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      hasHydrated: true,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
    });

    render(<RaffleContent id="raffle-1" />);

    expect(screen.queryByTestId('countdown')).not.toBeInTheDocument();
    expect(screen.getByText('Número ganador')).toBeInTheDocument();
    expect(screen.getByText('#17')).toBeInTheDocument();
    expect(screen.queryByText('Comprar Tickets')).not.toBeInTheDocument();
  });
});

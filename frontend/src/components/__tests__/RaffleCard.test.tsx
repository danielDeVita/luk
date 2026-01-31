import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useQuery, useMutation } from '@apollo/client/react';
import { useAuthStore } from '@/store/auth';
import { RaffleCard } from '../raffle/raffle-card';

// Mock the Countdown component
vi.mock('@/components/ui/countdown', () => ({
  Countdown: ({ targetDate }: { targetDate: string }) => (
    <span>Countdown: {targetDate}</span>
  ),
}));

// Mock the useConfirmDialog hook
vi.mock('@/hooks/use-confirm-dialog', () => ({
  useConfirmDialog: () => vi.fn().mockResolvedValue(true),
}));

// Mock cloudinary utility
vi.mock('@/lib/cloudinary', () => ({
  getOptimizedImageUrl: (url: string) => url,
  CLOUDINARY_PRESETS: { card: 'card' },
}));

describe('RaffleCard', () => {
  const mockRaffle = {
    id: 'raffle-1',
    titulo: 'iPhone 15 Pro Max',
    precioPorTicket: 100,
    totalTickets: 1000,
    ticketsVendidos: 500,
    fechaLimiteSorteo: '2025-12-31T23:59:59.000Z',
    estado: 'ACTIVA',
    product: {
      nombre: 'iPhone 15 Pro Max 256GB',
      imagenes: ['https://example.com/iphone.jpg'],
      condicion: 'Nuevo',
    },
    seller: {
      nombre: 'Juan',
      apellido: 'Perez',
    },
  };

  const mockUseQuery = vi.mocked(useQuery);
  const mockUseMutation = vi.mocked(useMutation);
  const mockUseAuthStore = vi.mocked(useAuthStore);

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null,
      hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
    });

    mockUseQuery.mockReturnValue({
      data: { isFavorite: false },
      loading: false,
      error: undefined,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);

    mockUseMutation.mockReturnValue([
      vi.fn(),
      { data: undefined, loading: false, error: undefined },
    ] as unknown as ReturnType<typeof useMutation>);
  });

  it('should render raffle title and product name', () => {
    render(<RaffleCard raffle={mockRaffle} />);

    expect(screen.getByText('iPhone 15 Pro Max')).toBeInTheDocument();
    expect(
      screen.getByText('iPhone 15 Pro Max 256GB'),
    ).toBeInTheDocument();
  });

  it('should display price per ticket', () => {
    render(<RaffleCard raffle={mockRaffle} />);

    expect(screen.getByText('$100')).toBeInTheDocument();
    expect(screen.getByText('por ticket')).toBeInTheDocument();
  });

  it('should show progress bar with correct percentage', () => {
    render(<RaffleCard raffle={mockRaffle} />);

    // 500 sold / 1000 total = 50%
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
  });

  it('should display countdown timer', () => {
    render(<RaffleCard raffle={mockRaffle} />);

    expect(screen.getByText(/Countdown:/i)).toBeInTheDocument();
  });

  it('should show favorite button for authenticated users', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'user-1', email: 'test@example.com' },
      hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
    });

    const { container } = render(<RaffleCard raffle={mockRaffle} />);

    const favoriteButton = container.querySelector(
      'button[title*="favoritos"]',
    );
    expect(favoriteButton).toBeInTheDocument();
  });

  it('should not show favorite button for unauthenticated users', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null,
      hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
    });

    const { container } = render(<RaffleCard raffle={mockRaffle} />);

    const favoriteButton = container.querySelector(
      'button[title*="favoritos"]',
    );
    expect(favoriteButton).not.toBeInTheDocument();
  });

  it('should toggle favorite when button is clicked', async () => {
    const mockAddFavorite = vi.fn();
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'user-1', email: 'test@example.com' },
      hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
    });

    mockUseMutation.mockReturnValue([
      mockAddFavorite,
      { data: undefined, loading: false, error: undefined },
    ] as unknown as ReturnType<typeof useMutation>);

    const { container } = render(<RaffleCard raffle={mockRaffle} />);

    const favoriteButton = container.querySelector(
      'button[title*="favoritos"]',
    );
    if (favoriteButton) {
      fireEvent.click(favoriteButton);

      await waitFor(() => {
        expect(mockAddFavorite).toHaveBeenCalled();
      });
    }
  });

  it('should display "Popular" badge when 75%+ tickets sold', () => {
    const popularRaffle = {
      ...mockRaffle,
      ticketsVendidos: 800, // 80% sold
    };

    render(<RaffleCard raffle={popularRaffle} />);

    expect(screen.getByText(/Popular/i)).toBeInTheDocument();
  });

  it('should display "Ultimos!" badge when 90%+ tickets sold', () => {
    const almostDoneRaffle = {
      ...mockRaffle,
      ticketsVendidos: 950, // 95% sold
    };

    render(<RaffleCard raffle={almostDoneRaffle} />);

    expect(screen.getByText(/Ultimos!/i)).toBeInTheDocument();
  });

  it('should display total value correctly', () => {
    render(<RaffleCard raffle={mockRaffle} />);

    // 100 * 1000 = 100000
    expect(screen.getByText('$100000')).toBeInTheDocument();
    expect(screen.getByText('valor total')).toBeInTheDocument();
  });
});

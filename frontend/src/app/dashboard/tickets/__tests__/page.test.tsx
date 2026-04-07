import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuery, useMutation } from '@apollo/client/react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import MyTicketsPage from '../page';
import type { ImgHTMLAttributes } from 'react';

vi.mock('@apollo/client/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('next/image', () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ''} />
  ),
}));

vi.mock('@/hooks/use-confirm-dialog', () => ({
  useConfirmDialog: () => vi.fn().mockResolvedValue(true),
}));

vi.mock('@/components/disputes/dispute-dialog', () => ({
  DisputeDialog: () => <button type="button">Abrir disputa</button>,
}));

vi.mock('@/components/social-promotions/promotion-bonus-grants-card', () => ({
  PromotionBonusGrantsCard: () => <div data-testid="promotion-bonus-card" />,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('MyTicketsPage seller reviews', () => {
  const mockUseQuery = vi.mocked(useQuery);
  const mockUseMutation = vi.mocked(useMutation);
  const mockUseRouter = vi.mocked(useRouter);
  const mockUseAuthStore = vi.mocked(useAuthStore);

  const getOperationName = (operation: unknown) =>
    (operation as { definitions?: Array<{ name?: { value?: string } }> })
      .definitions?.[0]?.name?.value ?? '';

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRouter.mockReturnValue({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    });
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      hasHydrated: true,
      user: { id: 'winner-1', email: 'winner@test.com' },
    } as unknown as ReturnType<typeof useAuthStore>);
  });

  it('shows review CTA only after confirmed delivery and submits seller review', async () => {
    const user = userEvent.setup();
    const createSellerReview = vi.fn();

    mockUseQuery.mockImplementation((operation) => {
      const operationName = getOperationName(operation);
      if (operationName === 'MyTickets') {
        return {
          data: {
            myTickets: [
              {
                id: 'ticket-1',
                numeroTicket: 7,
                estado: 'PAGADO',
                precioPagado: 1000,
                createdAt: '2026-04-01T12:00:00.000Z',
                raffle: {
                  id: 'raffle-1',
                  titulo: 'MacBook QA',
                  estado: 'FINALIZADA',
                  deliveryStatus: 'CONFIRMED',
                  winnerId: 'winner-1',
                  fechaLimiteSorteo: '2026-05-01T12:00:00.000Z',
                  review: null,
                  product: { imagenes: [] },
                },
              },
            ],
          },
          loading: false,
          error: undefined,
          refetch: vi.fn(),
        } as unknown as ReturnType<typeof useQuery>;
      }

      if (operationName === 'BuyerStats') {
        return {
          data: {
            buyerStats: {
              totalTicketsPurchased: 1,
              totalRafflesWon: 1,
              winRate: 100,
              totalSpent: 1000,
              activeTickets: 0,
              favoritesCount: 0,
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
      const operationName = getOperationName(operation);
      if (operationName === 'CreateSellerReview') {
        return [
          createSellerReview,
          { data: undefined, loading: false, error: undefined },
        ] as unknown as ReturnType<typeof useMutation>;
      }

      return [
        vi.fn(),
        { data: undefined, loading: false, error: undefined },
      ] as unknown as ReturnType<typeof useMutation>;
    });

    render(<MyTicketsPage />);

    expect(await screen.findByText('MacBook QA')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /dejar reseña/i }));
    await user.click(screen.getByRole('button', { name: /4 estrellas/i }));
    await user.type(
      screen.getByLabelText(/comentario opcional/i),
      'Entrega muy buena',
    );
    await user.click(screen.getByRole('button', { name: /enviar reseña/i }));

    expect(createSellerReview).toHaveBeenCalledWith({
      variables: {
        input: {
          raffleId: 'raffle-1',
          rating: 4,
          comentario: 'Entrega muy buena',
        },
      },
    });
  });

  it('shows sent-review state instead of the review CTA after a review exists', async () => {
    mockUseQuery.mockImplementation((operation) => {
      if (getOperationName(operation) === 'MyTickets') {
        return {
          data: {
            myTickets: [
              {
                id: 'ticket-1',
                numeroTicket: 7,
                estado: 'PAGADO',
                precioPagado: 1000,
                createdAt: '2026-04-01T12:00:00.000Z',
                raffle: {
                  id: 'raffle-1',
                  titulo: 'MacBook QA',
                  estado: 'FINALIZADA',
                  deliveryStatus: 'CONFIRMED',
                  winnerId: 'winner-1',
                  fechaLimiteSorteo: '2026-05-01T12:00:00.000Z',
                  review: { id: 'review-1' },
                  product: { imagenes: [] },
                },
              },
            ],
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
    mockUseMutation.mockReturnValue([
      vi.fn(),
      { data: undefined, loading: false, error: undefined },
    ] as unknown as ReturnType<typeof useMutation>);

    render(<MyTicketsPage />);

    expect(await screen.findByText('MacBook QA')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /dejar reseña/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /reseña enviada/i }),
    ).toBeInTheDocument();
  });
});

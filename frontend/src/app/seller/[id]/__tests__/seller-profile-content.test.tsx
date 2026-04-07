import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useQuery } from '@apollo/client/react';
import { SellerProfileContent } from '../seller-profile-content';

vi.mock('@apollo/client/react', () => ({
  useQuery: vi.fn(),
}));

vi.mock('@/components/raffle/raffle-card', () => ({
  RaffleCard: ({ raffle }: { raffle: { titulo: string } }) => (
    <article>{raffle.titulo}</article>
  ),
}));

describe('SellerProfileContent', () => {
  const mockUseQuery = vi.mocked(useQuery);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows public seller review summary and latest reviews', () => {
    mockUseQuery.mockReturnValue({
      data: {
        sellerProfile: {
          id: 'seller-1',
          nombre: 'Seller',
          apellido: 'Pro',
          createdAt: '2026-04-01T12:00:00.000Z',
          isVerified: true,
          nivelVendedor: 'BRONCE',
          totalVentas: 12,
          reputation: 4.7,
          reviewCount: 2,
          reviews: [
            {
              id: 'review-1',
              rating: 5,
              comentario: 'Entrega impecable',
              createdAt: '2026-04-02T12:00:00.000Z',
              reviewerName: 'Buyer Winner',
              raffleTitle: 'MacBook QA',
            },
          ],
          raffles: [{ id: 'raffle-1', titulo: 'Rifa publicada' }],
        },
      },
      loading: false,
      error: undefined,
    } as unknown as ReturnType<typeof useQuery>);

    render(<SellerProfileContent sellerId="seller-1" />);

    expect(
      screen.getByRole('heading', { name: /seller pro/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/4\.7 · 2 reseñas/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /reseñas del vendedor/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Entrega impecable')).toBeInTheDocument();
    expect(screen.getByText(/Buyer Winner · MacBook QA/)).toBeInTheDocument();
  });

  it('shows an empty public review state when seller has no reviews', () => {
    mockUseQuery.mockReturnValue({
      data: {
        sellerProfile: {
          id: 'seller-1',
          nombre: 'Seller',
          apellido: 'Nuevo',
          createdAt: '2026-04-01T12:00:00.000Z',
          isVerified: false,
          nivelVendedor: 'NUEVO',
          totalVentas: 0,
          reputation: null,
          reviewCount: 0,
          reviews: [],
          raffles: [],
        },
      },
      loading: false,
      error: undefined,
    } as unknown as ReturnType<typeof useQuery>);

    render(<SellerProfileContent sellerId="seller-1" />);

    expect(screen.getByText(/sin rating · 0 reseñas/i)).toBeInTheDocument();
    expect(
      screen.getByText(/todavía no tiene reseñas públicas/i),
    ).toBeInTheDocument();
  });
});

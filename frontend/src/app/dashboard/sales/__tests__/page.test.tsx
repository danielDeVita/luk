/* eslint-disable @next/next/no-img-element */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLazyQuery, useMutation, useQuery } from '@apollo/client/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import MySalesPage from '../page';

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
  useSearchParams: vi.fn(),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img alt="" {...props} />,
}));

vi.mock('@/components/ImageUpload', () => ({
  ImageUpload: () => <div data-testid="image-upload" />,
}));

vi.mock('@/components/social-promotions/social-promotion-manager', () => ({
  SocialPromotionManager: () => <div data-testid="social-promotion-manager" />,
  SocialPromotionPostsSummary: () => <div data-testid="social-promotion-summary" />,
}));

describe('Sales dashboard onboarding', () => {
  const mockUseQuery = vi.mocked(useQuery);
  const mockUseMutation = vi.mocked(useMutation);
  const mockUseLazyQuery = vi.mocked(useLazyQuery);
  const mockUseRouter = vi.mocked(useRouter);
  const mockUseSearchParams = vi.mocked(useSearchParams);
  const mockUseAuthStore = vi.mocked(useAuthStore);

  beforeEach(() => {
    vi.clearAllMocks();

    global.ResizeObserver = class ResizeObserver {
      observe() {}
      disconnect() {}
      unobserve() {}
    } as typeof ResizeObserver;

    mockUseRouter.mockReturnValue({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    });

    mockUseSearchParams.mockReturnValue(
      new URLSearchParams() as ReturnType<typeof useSearchParams>,
    );

    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      hasHydrated: true,
      user: {
        id: 'seller-1',
        email: 'seller@test.com',
        nombre: 'Juan',
        apellido: 'Pérez',
      },
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

    mockUseMutation.mockReturnValue([
      vi.fn(),
      { data: undefined, loading: false, error: undefined },
    ] as unknown as ReturnType<typeof useMutation>);

    mockUseLazyQuery.mockReturnValue([
      vi.fn(),
      { data: undefined, loading: false, error: undefined },
    ] as unknown as ReturnType<typeof useLazyQuery>);
  });

  it('shows the internal payout-data onboarding note when seller payments are not connected', async () => {
    mockUseQuery.mockImplementation((operation) => {
      const body = getOperationText(operation);

      if (body.includes('query MyRaffles')) {
        return {
          data: { myRafflesAsSeller: [] },
          loading: false,
          error: undefined,
          refetch: vi.fn(),
        } as unknown as ReturnType<typeof useQuery>;
      }

      if (body.includes('query SellerDashboardStats')) {
        return {
          data: {
            sellerDashboardStats: {
              totalRevenue: 0,
              totalTicketsSold: 0,
              activeRaffles: 0,
              completedRaffles: 0,
              totalViews: 0,
              conversionRate: 0,
              monthlyRevenue: [],
            },
          },
          loading: false,
          error: undefined,
          refetch: vi.fn(),
        } as unknown as ReturnType<typeof useQuery>;
      }

      if (body.includes('query GetOnboardingStatus')) {
        return {
          data: {
            me: {
              id: 'seller-1',
              nombre: 'Juan',
              apellido: 'Pérez',
              phone: '+54 11 1234-5678',
              sellerPaymentAccountStatus: 'NOT_CONNECTED',
              kycStatus: 'VERIFIED',
              street: 'Av. Corrientes',
              city: 'CABA',
              province: 'CABA',
              postalCode: '1043',
            },
          },
          loading: false,
          error: undefined,
          refetch: vi.fn(),
        } as unknown as ReturnType<typeof useQuery>;
      }

      if (body.includes('query MySocialPromotionPosts')) {
        return {
          data: { mySocialPromotionPosts: [] },
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

    render(<MySalesPage />);

    expect(await screen.findByText(/primeros pasos para vender/i)).toBeInTheDocument();
    expect(
      screen.getByText(/tus cobros se activan desde configuración cargando datos de cobro internos/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/cargar datos de cobro/i)).toBeInTheDocument();
  });
});

/* eslint-disable @next/next/no-img-element */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMutation, useQuery } from '@apollo/client/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import SettingsPage from '../page';

vi.mock('@apollo/client/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img alt="" {...props} />,
}));

vi.mock('@/hooks/use-confirm-dialog', () => ({
  useConfirmDialog: () => vi.fn().mockResolvedValue(true),
}));

vi.mock('@/components/auth/two-factor-settings-card', () => ({
  TwoFactorSettingsCard: () => <div data-testid="two-factor-settings-card" />,
}));

describe('SettingsPage payments tab', () => {
  const mockUseQuery = vi.mocked(useQuery);
  const mockUseMutation = vi.mocked(useMutation);
  const mockUseRouter = vi.mocked(useRouter);
  const mockUseSearchParams = vi.mocked(useSearchParams);
  const mockUseAuthStore = vi.mocked(useAuthStore);

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    mockUseRouter.mockReturnValue({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    });

    mockUseSearchParams.mockReturnValue({
      get: (key: string) => (key === 'tab' ? 'payments' : null),
    } as ReturnType<typeof useSearchParams>);

    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      hasHydrated: true,
      token: 'jwt-token',
      user: {
        id: 'seller-1',
        email: 'seller@test.com',
        nombre: 'Juan',
        apellido: 'Pérez',
        avatarUrl: undefined,
      },
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
      setAuth: vi.fn(),
      getToken: vi.fn(),
      setToken: vi.fn(),
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
  });

  it('shows the next settings onboarding nudge from current account data', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        me: {
          id: 'seller-1',
          avatarUrl: null,
          sellerPaymentAccountStatus: 'NOT_CONNECTED',
          sellerPaymentAccountId: null,
          sellerPaymentAccount: null,
          kycStatus: 'NOT_SUBMITTED',
          documentType: null,
          documentNumber: null,
          street: null,
          streetNumber: null,
          apartment: null,
          city: null,
          province: null,
          postalCode: null,
          phone: '+54 11 1234-5678',
          cuitCuil: null,
          termsAcceptedAt: null,
          termsVersion: null,
          kycRejectedReason: null,
          twoFactorEnabled: false,
          twoFactorEnabledAt: null,
        },
      },
      loading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);

    render(<SettingsPage />);

    expect(await screen.findByText('Verificá tu identidad')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /completar kyc/i })).toHaveAttribute(
      'href',
      '/dashboard/settings?tab=kyc',
    );
  });

  it('renders pending Mercado Pago payout state with prerequisites and connect CTA', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        me: {
          id: 'seller-1',
          avatarUrl: null,
          sellerPaymentAccountStatus: 'PENDING',
          sellerPaymentAccountId: null,
          sellerPaymentAccount: {
            id: 'spa-1',
            provider: 'MERCADO_PAGO',
            status: 'PENDING',
            providerAccountId: 'mp-seller-1',
            providerEmail: 'seller@mp.test',
            accountHolderName: null,
            accountIdentifierType: null,
            maskedAccountIdentifier: null,
            lastSyncedAt: null,
          },
          kycStatus: 'PENDING_REVIEW',
          documentType: null,
          documentNumber: null,
          street: 'Av. Corrientes',
          streetNumber: '1234',
          apartment: null,
          city: 'CABA',
          province: 'CABA',
          postalCode: '1043',
          phone: '+54 11 1234-5678',
          cuitCuil: null,
          termsAcceptedAt: null,
          termsVersion: null,
          kycRejectedReason: null,
          twoFactorEnabled: false,
          twoFactorEnabledAt: null,
        },
      },
      loading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);

    render(<SettingsPage />);

    expect(
      await screen.findByText(/mercado pago conectado, faltan requisitos/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/faltan kyc verificado, cuit\/cuil o dirección/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/requisitos para activar cobros/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /reconectar mercado pago/i }),
    ).toBeInTheDocument();
  });

  it('renders connected Mercado Pago payout account details and disconnect action', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        me: {
          id: 'seller-1',
          avatarUrl: null,
          sellerPaymentAccountStatus: 'CONNECTED',
          sellerPaymentAccountId: 'entity-1',
          sellerPaymentAccount: {
            id: 'spa-1',
            provider: 'MERCADO_PAGO',
            status: 'CONNECTED',
            providerAccountId: 'mp-seller-1',
            providerEmail: 'seller@mp.test',
            accountHolderName: null,
            accountIdentifierType: null,
            maskedAccountIdentifier: null,
            lastSyncedAt: '2026-04-14T15:00:00.000Z',
          },
          kycStatus: 'VERIFIED',
          documentType: null,
          documentNumber: null,
          street: 'Av. Corrientes',
          streetNumber: '1234',
          apartment: null,
          city: 'CABA',
          province: 'CABA',
          postalCode: '1043',
          phone: '+54 11 1234-5678',
          cuitCuil: '20-12345678-9',
          termsAcceptedAt: null,
          termsVersion: null,
          kycRejectedReason: null,
          twoFactorEnabled: false,
          twoFactorEnabledAt: null,
        },
      },
      loading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);

    render(<SettingsPage />);

    expect(await screen.findAllByText(/mercado pago conectado/i)).not.toHaveLength(0);
    expect(screen.getByText(/cuenta mp: seller@mp.test/i)).toBeInTheDocument();
    expect(screen.getByText(/id mercado pago: mp-seller-1/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /reconectar mercado pago/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /desconectar mercado pago/i }),
    ).toBeInTheDocument();
  });
});

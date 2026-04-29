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
  });

  it('renders pending internal payout data state with prerequisites and form CTA', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        me: {
          id: 'seller-1',
          avatarUrl: null,
          sellerPaymentAccountStatus: 'PENDING',
          sellerPaymentAccountId: null,
          sellerPaymentAccount: {
            id: 'spa-1',
            status: 'PENDING',
            accountHolderName: 'Juan Pérez',
            accountIdentifierType: 'ALIAS',
            maskedAccountIdentifier: 'ju***as',
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
      await screen.findByText(/datos de cobro pendientes/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/completá kyc, cuit\/cuil y dirección/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/requisitos para activar cobros/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /guardar datos de cobro/i }),
    ).toBeInTheDocument();
  });

  it('renders connected internal payout account details and disconnect action', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        me: {
          id: 'seller-1',
          avatarUrl: null,
          sellerPaymentAccountStatus: 'CONNECTED',
          sellerPaymentAccountId: 'entity-1',
          sellerPaymentAccount: {
            id: 'spa-1',
            status: 'CONNECTED',
            accountHolderName: 'Seller QA',
            accountIdentifierType: 'CBU',
            maskedAccountIdentifier: '2850****5201',
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

    expect(await screen.findAllByText(/datos de cobro activos/i)).toHaveLength(
      2,
    );
    expect(screen.getByText(/titular: seller qa/i)).toBeInTheDocument();
    expect(screen.getByText(/2850\*\*\*\*5201/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /guardar datos de cobro/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /desactivar datos/i })).toBeInTheDocument();
  });
});

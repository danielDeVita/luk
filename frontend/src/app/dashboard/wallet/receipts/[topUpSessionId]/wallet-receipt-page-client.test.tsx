import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuery } from '@apollo/client/react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { WalletReceiptPageClient } from './wallet-receipt-page-client';

vi.mock('@apollo/client/react', () => ({
  useQuery: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

describe('WalletReceiptPageClient', () => {
  const mockUseQuery = vi.mocked(useQuery);
  const mockUseRouter = vi.mocked(useRouter);
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
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      hasHydrated: true,
    } as unknown as ReturnType<typeof useAuthStore>);
  });

  it('renders the stored wallet receipt data', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        creditTopUpReceipt: {
          topUpSessionId: 'topup-1',
          provider: 'MERCADO_PAGO',
          amount: 3000,
          creditedAmount: 3000,
          status: 'APPROVED',
          statusDetail: 'accredited',
          providerPaymentId: 'mp-payment-1',
          providerOrderId: 'preference-1',
          receiptVersion: 1,
          createdAt: '2026-04-01T12:00:00.000Z',
          approvedAt: '2026-04-01T12:01:00.000Z',
          receiptIssuedAt: '2026-04-01T12:01:00.000Z',
          creditBalanceAfter: 4500,
        },
      },
      loading: false,
      error: undefined,
    } as unknown as ReturnType<typeof useQuery>);

    render(<WalletReceiptPageClient topUpSessionId="topup-1" />);

    expect(await screen.findByText('Comprobante de carga')).toBeInTheDocument();
    expect(screen.getByText('mp-payment-1')).toBeInTheDocument();
    expect(screen.getByText('preference-1')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /volver a la wallet/i }),
    ).toHaveAttribute('href', '/dashboard/wallet');
  });
});

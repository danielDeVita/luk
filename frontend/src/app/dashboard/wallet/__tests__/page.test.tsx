import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMutation, useQuery } from '@apollo/client/react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import WalletPage from '../page';

vi.mock('@apollo/client/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('WalletPage', () => {
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
    } as unknown as ReturnType<typeof useAuthStore>);
    mockUseMutation.mockReturnValue([
      vi.fn(),
      { data: undefined, loading: false, error: undefined },
    ] as unknown as ReturnType<typeof useMutation>);
  });

  it('shows receipt links only for eligible credit top-ups', async () => {
    mockUseQuery.mockImplementation((operation) => {
      const operationName = getOperationName(operation);

      if (operationName === 'MyWallet') {
        return {
          data: {
            myWallet: {
              id: 'wallet-1',
              creditBalance: 3000,
              sellerPayableBalance: 0,
            },
          },
          loading: false,
          error: undefined,
        } as unknown as ReturnType<typeof useQuery>;
      }

      if (operationName === 'WalletLedger') {
        return {
          data: {
            walletLedger: [
              {
                id: 'ledger-1',
                type: 'CREDIT_TOP_UP',
                amount: 3000,
                creditTopUpSessionId: 'topup-1',
                topUpReceiptAvailable: true,
                creditBalanceAfter: 3000,
                sellerPayableBalanceAfter: 0,
                createdAt: '2026-04-01T12:00:00.000Z',
              },
              {
                id: 'ledger-2',
                type: 'CREDIT_TOP_UP',
                amount: 2000,
                creditTopUpSessionId: 'topup-2',
                topUpReceiptAvailable: false,
                creditBalanceAfter: 5000,
                sellerPayableBalanceAfter: 0,
                createdAt: '2026-04-02T12:00:00.000Z',
              },
            ],
          },
          loading: false,
          error: undefined,
        } as unknown as ReturnType<typeof useQuery>;
      }

      return {
        data: undefined,
        loading: false,
        error: undefined,
      } as unknown as ReturnType<typeof useQuery>;
    });

    render(<WalletPage />);

    const links = await screen.findAllByRole('link', {
      name: /ver comprobante/i,
    });

    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute(
      'href',
      '/dashboard/wallet/receipts/topup-1',
    );
  });
});

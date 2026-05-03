import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMutation, useQuery } from '@apollo/client/react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { TicketReceiptPageClient } from './ticket-receipt-page-client';

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

describe('TicketReceiptPageClient', () => {
  const mockUseQuery = vi.mocked(useQuery);
  const mockUseMutation = vi.mocked(useMutation);
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

  it('renders the receipt and acknowledges it from the detail page', async () => {
    const acknowledgeMutation = vi.fn();

    mockUseQuery.mockReturnValue({
      data: {
        ticketPurchaseReceipt: {
          id: 'receipt-1',
          purchaseReference: 'purchase-ref-1',
          raffleId: 'raffle-1',
          raffleTitleSnapshot: 'Rifa QA',
          receiptVersion: 1,
          currencyCode: 'ARS',
          ticketNumbers: [3, 7],
          grossSubtotal: 200,
          packDiscountAmount: 0,
          promotionDiscountAmount: 0,
          selectionPremiumPercent: 5,
          selectionPremiumAmount: 10,
          chargedAmount: 210,
          baseQuantity: 2,
          bonusQuantity: 0,
          grantedQuantity: 2,
          packApplied: false,
          purchaseMode: 'CHOOSE_NUMBERS',
          buyerAcceptedAt: null,
          acceptanceSource: null,
          acceptancePending: true,
          createdAt: '2026-04-01T12:00:00.000Z',
          updatedAt: '2026-04-01T12:00:00.000Z',
        },
      },
      loading: false,
      error: undefined,
    } as unknown as ReturnType<typeof useQuery>);
    mockUseMutation.mockReturnValue([
      acknowledgeMutation,
      { data: undefined, loading: false, error: undefined },
    ] as unknown as ReturnType<typeof useMutation>);

    render(<TicketReceiptPageClient purchaseReference="purchase-ref-1" />);

    expect(await screen.findByText('Comprobante de compra')).toBeInTheDocument();
    expect(screen.getByText('Rifa QA')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', {
        name: /confirmar que veo mis números/i,
      }),
    );

    expect(acknowledgeMutation).toHaveBeenCalledWith({
      variables: {
        purchaseReference: 'purchase-ref-1',
        source: 'RECEIPT_PAGE',
      },
    });
  });
});

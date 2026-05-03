import { expect, test } from '@playwright/test';

type GraphQLPayload = {
  operationName?: string;
  variables?: Record<string, unknown>;
};

test.describe('Receipts Flow', () => {
  test('shows wallet and ticket receipts, and confirms ticket visibility', async ({
    page,
  }) => {
    let receiptAcknowledged = false;

    await page.addInitScript(() => {
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            user: {
              id: 'buyer-1',
              email: 'comprador@test.com',
              nombre: 'Comprador',
              apellido: 'QA',
              role: 'USER',
            },
            token:
              'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0=.eyJzdWIiOiJidXllci0xIiwiZXhwIjo0MTAyNDQ0ODAwfQ==.e2e',
            isAuthenticated: true,
          },
          version: 0,
        }),
      );
    });

    await page.route('**/graphql', async (route) => {
      const payload = route.request().postDataJSON() as GraphQLPayload;
      const operationName = payload.operationName;

      const dataByOperation: Record<string, unknown> = {
        MyWallet: {
          myWallet: {
            id: 'wallet-1',
            creditBalance: 3000,
            sellerPayableBalance: 0,
            __typename: 'WalletAccountEntity',
          },
        },
        WalletLedger: {
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
              __typename: 'WalletLedgerEntryEntity',
            },
          ],
        },
        CreditTopUpReceipt: {
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
            creditBalanceAfter: 3000,
            __typename: 'CreditTopUpReceiptEntity',
          },
        },
        AcknowledgeTicketPurchaseReceiptFromPage: {
          acknowledgeTicketPurchaseReceipt: {
            purchaseReference: 'purchase-ref-1',
            buyerAcceptedAt: '2026-04-01T12:05:00.000Z',
            acceptanceSource: 'RECEIPT_PAGE',
            acceptancePending: false,
            updatedAt: '2026-04-01T12:05:00.000Z',
            __typename: 'TicketPurchaseReceiptEntity',
          },
        },
        TicketPurchaseReceipt: {
          ticketPurchaseReceipt: {
            id: 'receipt-1',
            purchaseReference: 'purchase-ref-1',
            raffleId: 'raffle-1',
            raffleTitleSnapshot: 'Rifa QA',
            receiptVersion: 1,
            currencyCode: 'ARS',
            ticketNumbers: [12],
            grossSubtotal: 100,
            packDiscountAmount: 0,
            promotionDiscountAmount: 0,
            selectionPremiumPercent: 0,
            selectionPremiumAmount: 0,
            chargedAmount: 100,
            baseQuantity: 1,
            bonusQuantity: 0,
            grantedQuantity: 1,
            packApplied: false,
            purchaseMode: 'RANDOM',
            buyerAcceptedAt: receiptAcknowledged
              ? '2026-04-01T12:05:00.000Z'
              : null,
            acceptanceSource: receiptAcknowledged ? 'RECEIPT_PAGE' : null,
            acceptancePending: !receiptAcknowledged,
            createdAt: '2026-04-01T12:00:00.000Z',
            updatedAt: receiptAcknowledged
              ? '2026-04-01T12:05:00.000Z'
              : '2026-04-01T12:00:00.000Z',
            __typename: 'TicketPurchaseReceiptEntity',
          },
        },
        MyTickets: {
          myTickets: [
            {
              id: 'ticket-1',
              numeroTicket: 12,
              estado: 'PAGADO',
              precioPagado: 100,
              createdAt: '2026-04-01T12:00:00.000Z',
              raffle: {
                id: 'raffle-1',
                titulo: 'Rifa QA',
                estado: 'ACTIVA',
                deliveryStatus: 'PENDING',
                trackingNumber: null,
                paymentReleasedAt: null,
                winnerId: null,
                fechaLimiteSorteo: '2026-12-31T23:00:00.000Z',
                review: null,
                product: {
                  imagenes: [],
                  __typename: 'Product',
                },
                __typename: 'Raffle',
              },
              __typename: 'Ticket',
            },
          ],
        },
        MyTicketPurchaseReceipts: {
          myTicketPurchaseReceipts: [
            {
              id: 'receipt-1',
              purchaseReference: 'purchase-ref-1',
              raffleId: 'raffle-1',
              raffleTitleSnapshot: 'Rifa QA',
              ticketNumbers: [12],
              chargedAmount: 100,
              baseQuantity: 1,
              bonusQuantity: 0,
              grantedQuantity: 1,
              buyerAcceptedAt: receiptAcknowledged
                ? '2026-04-01T12:05:00.000Z'
                : null,
              acceptancePending: !receiptAcknowledged,
              createdAt: '2026-04-01T12:00:00.000Z',
              __typename: 'TicketPurchaseReceiptSummaryEntity',
            },
          ],
        },
        BuyerStats: {
          buyerStats: {
            totalTicketsPurchased: 1,
            totalRafflesWon: 0,
            winRate: 0,
            totalSpent: 100,
            activeTickets: 1,
            favoritesCount: 0,
            __typename: 'BuyerStats',
          },
        },
        RecommendedRaffles: {
          recommendedRaffles: [],
        },
        FavoritesEndingSoon: {
          favoritesEndingSoon: [],
        },
      };

      if (operationName === 'AcknowledgeTicketPurchaseReceiptFromPage') {
        receiptAcknowledged = true;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: dataByOperation[operationName ?? ''] ?? {},
        }),
      });
    });

    await page.goto('/dashboard/wallet');
    await expect(
      page.getByRole('link', { name: /ver comprobante/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /ver comprobante/i }),
    ).toHaveAttribute('href', '/dashboard/wallet/receipts/topup-1');

    await page.goto('/dashboard/wallet/receipts/topup-1');
    await expect(
      page.getByRole('heading', { name: /comprobante de carga/i }),
    ).toBeVisible();
    await expect(page.getByText('mp-payment-1')).toBeVisible();

    await page.goto('/dashboard/tickets/receipts/purchase-ref-1');
    await expect(
      page.getByRole('heading', { name: /comprobante de compra/i }),
    ).toBeVisible();
    await expect(page.getByText('#12')).toBeVisible();
    await expect(page.getByText('Pendiente de confirmación')).toBeVisible();

    await page.getByRole('button', {
      name: /confirmar que veo mis números/i,
    }).click();
    await expect(
      page.getByText('Ya confirmaste este comprobante.'),
    ).toBeVisible();

    await page.goto('/dashboard/tickets');
    await expect(page.getByText('Comprobantes de compra')).toBeVisible();
    await expect(page.getByText('Confirmado')).toBeVisible();
  });
});

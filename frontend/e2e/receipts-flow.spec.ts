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
            },
            token: 'test-token',
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
        GetRaffle: {
          raffle: {
            id: 'raffle-1',
            titulo: 'Rifa QA',
            descripcion: 'Probando comprobantes de compra.',
            totalTickets: 100,
            precioPorTicket: 100,
            estado: 'ACTIVA',
            fechaLimiteSorteo: '2026-12-31T23:00:00.000Z',
            winnerId: null,
            winningTicketNumber: null,
            product: {
              nombre: 'Producto QA',
              descripcionDetallada: 'Detalle QA',
              imagenes: [],
              categoria: 'ELECTRONICA',
              condicion: 'NUEVO',
              __typename: 'Product',
            },
            seller: {
              id: 'seller-1',
              nombre: 'Seller',
              apellido: 'QA',
              email: 'seller@test.com',
              __typename: 'User',
            },
            tickets: [],
            __typename: 'Raffle',
          },
        },
        IsFavorite: {
          isFavorite: false,
        },
        GetPriceHistory: {
          priceHistory: [],
        },
        MyTicketCountInRaffle: {
          myTicketCountInRaffle: 0,
        },
        IncrementRaffleViews: {
          incrementRaffleViews: true,
        },
        BuyTickets: {
          buyTickets: {
            tickets: [
              {
                id: 'ticket-1',
                numeroTicket: 12,
                purchaseReference: 'purchase-ref-1',
                __typename: 'Ticket',
              },
            ],
            purchaseReference: 'purchase-ref-1',
            paidWithCredit: true,
            creditDebited: 100,
            creditBalanceAfter: 2900,
            totalAmount: 100,
            grossSubtotal: 100,
            discountApplied: 0,
            chargedAmount: 100,
            bonusGrantId: null,
            cantidadComprada: 1,
            baseQuantity: 1,
            bonusQuantity: 0,
            grantedQuantity: 1,
            packApplied: false,
            packIneligibilityReason: null,
            ticketsRestantesQuePuedeComprar: 49,
            purchaseMode: 'RANDOM',
            selectionPremiumPercent: 0,
            selectionPremiumAmount: 0,
            __typename: 'BuyTicketsResult',
          },
        },
        AcknowledgeTicketPurchaseReceipt: {
          acknowledgeTicketPurchaseReceipt: {
            purchaseReference: 'purchase-ref-1',
            buyerAcceptedAt: '2026-04-01T12:05:00.000Z',
            acceptancePending: false,
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

      if (operationName === 'AcknowledgeTicketPurchaseReceipt') {
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

    await page.getByRole('link', { name: /ver comprobante/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/wallet\/receipts\/topup-1/);
    await expect(page.getByText('mp-payment-1')).toBeVisible();

    await page.goto('/raffle/raffle-1');
    await page.getByRole('button', { name: /comprar 1 ticket/i }).click();

    await expect(
      page.getByRole('heading', { name: /comprobante de compra emitido/i }),
    ).toBeVisible();
    await page.getByRole('button', {
      name: /confirmar que veo mis números/i,
    }).click();

    await page.goto('/dashboard/tickets');
    await expect(page.getByText('Comprobantes de compra')).toBeVisible();
    await expect(page.getByText('Confirmado')).toBeVisible();
  });
});

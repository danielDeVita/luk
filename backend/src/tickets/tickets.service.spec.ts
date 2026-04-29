import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { Prisma, RaffleStatus, WalletLedgerEntryType } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PayoutsService } from '../payouts/payouts.service';
import { PrismaService } from '../prisma/prisma.service';
import { SocialPromotionsService } from '../social-promotions/social-promotions.service';
import { WalletService } from '../wallet/wallet.service';
import { TicketPurchaseMode } from '../common/enums';
import { TicketsService } from './tickets.service';

describe('TicketsService', () => {
  let service: TicketsService;

  const prisma = {
    shippingAddress: { count: jest.fn() },
    $transaction: jest.fn(),
    user: { findUnique: jest.fn() },
    raffle: { findUnique: jest.fn() },
    ticket: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const walletService = {
    debitUserBalance: jest.fn(),
    creditUserBalance: jest.fn(),
    creditSellerPayable: jest.fn(),
    debitSellerPayable: jest.fn(),
  };

  const socialPromotionsService = {
    reserveBonusForCheckout: jest.fn(),
    markRedemptionUsedByReservation: jest.fn(),
    recordPurchaseAttribution: jest.fn(),
    reinstateRedemptionByPurchaseReference: jest.fn(),
  };

  const notificationsService = {
    sendTicketPurchaseConfirmation: jest.fn(),
    sendSellerTicketPurchasedNotification: jest.fn(),
    create: jest.fn(),
    notifyRaffleCompleted: jest.fn(),
    notifyRaffleDrawn: jest.fn(),
  };

  const activityService = {
    logTicketsPurchased: jest.fn(),
    logTicketsRefunded: jest.fn(),
    logPaymentReceived: jest.fn(),
    logRaffleCompleted: jest.fn(),
    logRaffleDrawn: jest.fn(),
  };

  const payoutsService = {
    createPayout: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  const configService = {
    get: jest.fn((key: string) => {
      const values: Record<string, string | number> = {
        PLATFORM_FEE_PERCENT: '4',
        SELECTED_NUMBER_PREMIUM_PERCENT: 5,
      };
      return values[key];
    }),
  };

  const activeRaffle = {
    id: 'raffle-1',
    estado: RaffleStatus.ACTIVA,
    is_hidden: false,
    seller_id: 'seller-1',
    total_tickets: 100,
    precio_por_ticket: new Prisma.Decimal(100),
    titulo: 'Rifa QA',
    sold_count: BigInt(0),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.shippingAddress.count.mockResolvedValue(1);
    prisma.user.findUnique.mockResolvedValue({
      email: 'buyer@luk.test',
      nombre: 'Buyer',
    });
    prisma.raffle.findUnique.mockResolvedValue({
      id: 'raffle-1',
      titulo: 'Rifa QA',
      sellerId: 'seller-1',
      totalTickets: 100,
      seller: {
        id: 'seller-1',
        email: 'seller@luk.test',
        nombre: 'Seller',
        apellido: 'QA',
      },
      tickets: [],
    });
    walletService.debitUserBalance.mockResolvedValue({
      creditBalance: new Prisma.Decimal(900),
    });
    walletService.creditSellerPayable.mockResolvedValue({
      sellerPayableBalance: new Prisma.Decimal(576),
    });
    socialPromotionsService.reserveBonusForCheckout.mockResolvedValue(null);
    socialPromotionsService.markRedemptionUsedByReservation.mockResolvedValue(
      undefined,
    );
    socialPromotionsService.recordPurchaseAttribution.mockResolvedValue(
      undefined,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
        { provide: WalletService, useValue: walletService },
        {
          provide: SocialPromotionsService,
          useValue: socialPromotionsService,
        },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: ActivityService, useValue: activityService },
        { provide: PayoutsService, useValue: payoutsService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get(TicketsService);
  });

  function mockPurchaseTransaction(raffle = activeRaffle) {
    const createdTickets: Array<{
      id: string;
      raffleId: string;
      buyerId: string;
      numeroTicket: number;
      precioPagado: Prisma.Decimal;
      estado: string;
      purchaseReference: string;
    }> = [];

    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([raffle]),
        ticket: {
          count: jest.fn().mockResolvedValue(0),
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn(({ data }) => {
            const ticket = {
              id: `ticket-${data.numeroTicket}`,
              ...data,
            };
            createdTickets.push(ticket);
            return Promise.resolve(ticket);
          }),
        },
        transaction: { create: jest.fn().mockResolvedValue({ id: 'tx-1' }) },
        userReputation: {
          upsert: jest.fn().mockResolvedValue({ userId: 'buyer-1' }),
        },
      };
      return callback(tx);
    });

    return createdTickets;
  }

  it('fails before reserving tickets when the buyer has no shipping address', async () => {
    prisma.shippingAddress.count.mockResolvedValue(0);

    await expect(service.buyTickets('buyer-1', 'raffle-1', 1)).rejects.toThrow(
      BadRequestException,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(walletService.debitUserBalance).not.toHaveBeenCalled();
  });

  it('buys random tickets with Saldo LUK and applies the 5 -> 6 pack', async () => {
    const createdTickets = mockPurchaseTransaction();

    const result = await service.buyTickets('buyer-1', 'raffle-1', 5);

    expect(result.paidWithCredit).toBe(true);
    expect(result.baseQuantity).toBe(5);
    expect(result.bonusQuantity).toBe(1);
    expect(result.grantedQuantity).toBe(6);
    expect(result.packApplied).toBe(true);
    expect(result.creditDebited).toBe(500);
    expect(createdTickets).toHaveLength(6);
    expect(createdTickets.every((ticket) => ticket.estado === 'PAGADO')).toBe(
      true,
    );
    expect(walletService.debitUserBalance).toHaveBeenCalledWith(
      expect.any(Object),
      'buyer-1',
      500,
      WalletLedgerEntryType.TICKET_PURCHASE_DEBIT,
      expect.objectContaining({ raffleId: 'raffle-1' }),
    );
    expect(walletService.creditSellerPayable).toHaveBeenCalledWith(
      expect.any(Object),
      'seller-1',
      576,
      expect.objectContaining({ raffleId: 'raffle-1' }),
    );
  });

  it('keeps choose-numbers premium and does not apply simple pack', async () => {
    mockPurchaseTransaction();

    const result = await service.buySelectedTickets(
      'buyer-1',
      'raffle-1',
      [3, 7],
    );

    expect(result.purchaseMode).toBe(TicketPurchaseMode.CHOOSE_NUMBERS);
    expect(result.packApplied).toBe(false);
    expect(result.selectionPremiumAmount).toBe(10);
    expect(result.creditDebited).toBe(210);
    expect(walletService.debitUserBalance).toHaveBeenCalledWith(
      expect.any(Object),
      'buyer-1',
      210,
      WalletLedgerEntryType.TICKET_PURCHASE_DEBIT,
      expect.any(Object),
    );
  });

  it('does not reserve a social promotion bonus when the simple pack applies', async () => {
    mockPurchaseTransaction();

    await service.buyTickets('buyer-1', 'raffle-1', 10, 'bonus-grant-1');

    expect(
      socialPromotionsService.reserveBonusForCheckout,
    ).not.toHaveBeenCalled();
  });
});

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Prisma,
  TicketPurchaseMode,
  TicketReceiptAcceptanceSource,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TicketPurchaseReceiptsService } from './ticket-purchase-receipts.service';

describe('TicketPurchaseReceiptsService', () => {
  let service: TicketPurchaseReceiptsService;

  const prisma = {
    ticketPurchaseReceipt: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const baseReceipt = {
    id: 'receipt-1',
    purchaseReference: 'purchase-ref-1',
    buyerId: 'buyer-1',
    raffleId: 'raffle-1',
    receiptVersion: 1,
    currencyCode: 'ARS',
    raffleTitleSnapshot: 'Rifa QA',
    ticketNumbers: [5, 8],
    grossSubtotal: new Prisma.Decimal(200),
    packDiscountAmount: new Prisma.Decimal(0),
    promotionDiscountAmount: new Prisma.Decimal(0),
    selectionPremiumPercent: new Prisma.Decimal(5),
    selectionPremiumAmount: new Prisma.Decimal(10),
    chargedAmount: new Prisma.Decimal(210),
    baseQuantity: 2,
    bonusQuantity: 0,
    grantedQuantity: 2,
    packApplied: false,
    purchaseMode: TicketPurchaseMode.CHOOSE_NUMBERS,
    buyerAcceptedAt: null,
    acceptanceSource: null,
    createdAt: new Date('2026-01-02T10:00:00.000Z'),
    updatedAt: new Date('2026-01-02T10:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketPurchaseReceiptsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(TicketPurchaseReceiptsService);
  });

  it('returns a receipt for its owner', async () => {
    prisma.ticketPurchaseReceipt.findUnique.mockResolvedValue(baseReceipt);

    const result = await service.getReceipt('buyer-1', 'purchase-ref-1');

    expect(result).toEqual(
      expect.objectContaining({
        purchaseReference: 'purchase-ref-1',
        chargedAmount: 210,
        selectionPremiumAmount: 10,
        acceptancePending: true,
      }),
    );
  });

  it('lists recent receipts and supports pending filtering', async () => {
    prisma.ticketPurchaseReceipt.findMany.mockResolvedValue([baseReceipt]);

    const result = await service.listReceipts('buyer-1', 10, true);

    expect(prisma.ticketPurchaseReceipt.findMany).toHaveBeenCalledWith({
      where: {
        buyerId: 'buyer-1',
        buyerAcceptedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    expect(result).toEqual([
      expect.objectContaining({
        purchaseReference: 'purchase-ref-1',
        acceptancePending: true,
      }),
    ]);
  });

  it('acknowledges a pending receipt and records the source', async () => {
    prisma.ticketPurchaseReceipt.findUnique.mockResolvedValue(baseReceipt);
    prisma.ticketPurchaseReceipt.update.mockResolvedValue({
      ...baseReceipt,
      buyerAcceptedAt: new Date('2026-01-02T10:05:00.000Z'),
      acceptanceSource: TicketReceiptAcceptanceSource.RECEIPT_PAGE,
    });

    const result = await service.acknowledgeReceipt(
      'buyer-1',
      'purchase-ref-1',
      TicketReceiptAcceptanceSource.RECEIPT_PAGE,
    );

    expect(prisma.ticketPurchaseReceipt.update).toHaveBeenCalledWith({
      where: { purchaseReference: 'purchase-ref-1' },
      data: {
        buyerAcceptedAt: expect.any(Date),
        acceptanceSource: TicketReceiptAcceptanceSource.RECEIPT_PAGE,
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        purchaseReference: 'purchase-ref-1',
        acceptancePending: false,
        acceptanceSource: TicketReceiptAcceptanceSource.RECEIPT_PAGE,
      }),
    );
  });

  it('returns an already acknowledged receipt without rewriting it', async () => {
    prisma.ticketPurchaseReceipt.findUnique.mockResolvedValue({
      ...baseReceipt,
      buyerAcceptedAt: new Date('2026-01-02T10:05:00.000Z'),
      acceptanceSource: TicketReceiptAcceptanceSource.TICKETS_DASHBOARD,
    });

    const result = await service.acknowledgeReceipt(
      'buyer-1',
      'purchase-ref-1',
      TicketReceiptAcceptanceSource.RECEIPT_PAGE,
    );

    expect(prisma.ticketPurchaseReceipt.update).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        acceptancePending: false,
        acceptanceSource: TicketReceiptAcceptanceSource.TICKETS_DASHBOARD,
      }),
    );
  });

  it('rejects access to receipts owned by another buyer', async () => {
    prisma.ticketPurchaseReceipt.findUnique.mockResolvedValue({
      ...baseReceipt,
      buyerId: 'buyer-2',
    });

    await expect(
      service.getReceipt('buyer-1', 'purchase-ref-1'),
    ).rejects.toThrow(NotFoundException);
  });
});

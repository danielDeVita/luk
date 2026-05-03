import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Prisma, WalletLedgerEntryType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from './wallet.service';

describe('WalletService', () => {
  let service: WalletService;
  let prismaService: PrismaService;

  const prisma = {
    walletAccount: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    walletLedgerEntry: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    creditTopUpSession: {
      findFirst: jest.fn(),
    },
    transaction: {
      findFirst: jest.fn(),
    },
  };

  const walletAccount = {
    id: 'wallet-1',
    userId: 'user-1',
    creditBalance: new Prisma.Decimal(100),
    sellerPayableBalance: new Prisma.Decimal(25),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [WalletService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(WalletService);
    prismaService = module.get(PrismaService);
    prisma.walletAccount.upsert.mockResolvedValue(walletAccount);
    prisma.walletAccount.update.mockResolvedValue({
      ...walletAccount,
      creditBalance: new Prisma.Decimal(150),
    });
    prisma.walletLedgerEntry.create.mockResolvedValue({ id: 'ledger-1' });
  });

  it('creates a wallet account automatically when reading a wallet', async () => {
    const result = await service.getWallet('user-1');

    expect(prisma.walletAccount.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { userId: 'user-1' },
      update: {},
    });
    expect(result).toEqual({
      ...walletAccount,
      creditBalance: 100,
      sellerPayableBalance: 25,
    });
  });

  it('credits Saldo LUK and appends a ledger entry', async () => {
    const result = await service.creditUserBalance(
      prismaService,
      'user-1',
      50,
      WalletLedgerEntryType.CREDIT_TOP_UP,
      { creditTopUpSessionId: 'topup-1' },
    );

    expect(prisma.walletAccount.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: { creditBalance: { increment: 50 } },
    });
    expect(prisma.walletLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        walletAccountId: 'wallet-1',
        userId: 'user-1',
        type: WalletLedgerEntryType.CREDIT_TOP_UP,
        amount: 50,
        creditTopUpSessionId: 'topup-1',
      }),
    });
    expect(Number(result.creditBalance)).toBe(150);
  });

  it('debits Saldo LUK and stores a negative ledger movement', async () => {
    prisma.walletAccount.update.mockResolvedValue({
      ...walletAccount,
      creditBalance: new Prisma.Decimal(70),
    });

    await service.debitUserBalance(
      prismaService,
      'user-1',
      30,
      WalletLedgerEntryType.TICKET_PURCHASE_DEBIT,
      { raffleId: 'raffle-1' },
    );

    expect(prisma.walletAccount.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: { creditBalance: { decrement: 30 } },
    });
    expect(prisma.walletLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: WalletLedgerEntryType.TICKET_PURCHASE_DEBIT,
        amount: -30,
        raffleId: 'raffle-1',
      }),
    });
  });

  it('fails debits before creating movements when balance is insufficient', async () => {
    prisma.walletAccount.upsert.mockResolvedValue({
      ...walletAccount,
      creditBalance: new Prisma.Decimal(20),
    });

    await expect(
      service.debitUserBalance(
        prismaService,
        'user-1',
        30,
        WalletLedgerEntryType.TICKET_PURCHASE_DEBIT,
        { raffleId: 'raffle-1' },
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.walletAccount.update).not.toHaveBeenCalled();
    expect(prisma.walletLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('marks top-up ledger entries with receipt availability when the receipt exists', async () => {
    prisma.walletLedgerEntry.findMany.mockResolvedValue([
      {
        id: 'ledger-1',
        userId: 'user-1',
        type: WalletLedgerEntryType.CREDIT_TOP_UP,
        amount: new Prisma.Decimal(50),
        creditBalanceAfter: new Prisma.Decimal(150),
        sellerPayableBalanceAfter: new Prisma.Decimal(25),
        raffleId: null,
        creditTopUpSessionId: 'topup-1',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        creditTopUpSession: { receiptVersion: 1 },
      },
    ]);

    const result = await service.getLedger('user-1', 10);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'ledger-1',
        amount: 50,
        creditTopUpSessionId: 'topup-1',
        topUpReceiptAvailable: true,
      }),
    ]);
  });

  it('returns the wallet receipt only for the owner and eligible top-ups', async () => {
    prisma.creditTopUpSession.findFirst.mockResolvedValue({
      id: 'topup-1',
      userId: 'user-1',
      provider: 'MERCADO_PAGO',
      amount: new Prisma.Decimal(3000),
      creditedAmount: new Prisma.Decimal(3000),
      providerPaymentId: 'mp-payment-1',
      providerOrderId: 'preference-1',
      status: 'APPROVED',
      statusDetail: 'accredited',
      receiptVersion: 1,
      createdAt: new Date('2026-01-02T10:00:00.000Z'),
      approvedAt: new Date('2026-01-02T10:01:00.000Z'),
      receiptIssuedAt: new Date('2026-01-02T10:01:00.000Z'),
    });
    prisma.walletLedgerEntry.findFirst.mockResolvedValue({
      id: 'ledger-1',
      creditBalanceAfter: new Prisma.Decimal(4100),
    });
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      monto: new Prisma.Decimal(3000),
    });

    const result = await service.getCreditTopUpReceipt('user-1', 'topup-1');

    expect(prisma.creditTopUpSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'topup-1',
        userId: 'user-1',
        receiptVersion: 1,
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        topUpSessionId: 'topup-1',
        provider: 'MERCADO_PAGO',
        amount: 3000,
        creditedAmount: 3000,
        providerPaymentId: 'mp-payment-1',
        providerOrderId: 'preference-1',
        receiptVersion: 1,
        creditBalanceAfter: 4100,
      }),
    );
  });
});

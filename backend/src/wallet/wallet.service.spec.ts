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
});

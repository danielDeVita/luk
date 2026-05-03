import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WalletLedgerEntryType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

interface LedgerContext {
  raffleId?: string | null;
  creditTopUpSessionId?: string | null;
  payoutId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getWallet(userId: string) {
    const wallet = await this.ensureWalletAccount(this.prisma, userId);
    return this.toWalletEntity(wallet);
  }

  async getLedger(userId: string, take = 50) {
    const entries = await this.prisma.walletLedgerEntry.findMany({
      where: { userId },
      include: {
        creditTopUpSession: {
          select: {
            receiptVersion: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 100),
    });

    return entries.map((entry) => this.toLedgerEntity(entry));
  }

  async getCreditTopUpReceipt(userId: string, topUpSessionId: string) {
    const topUp = await this.prisma.creditTopUpSession.findFirst({
      where: {
        id: topUpSessionId,
        userId,
        receiptVersion: 1,
      },
    });

    if (!topUp) {
      throw new NotFoundException('Comprobante de carga no encontrado');
    }

    const [ledgerEntry, transaction] = await Promise.all([
      this.prisma.walletLedgerEntry.findFirst({
        where: {
          userId,
          creditTopUpSessionId: topUp.id,
          type: WalletLedgerEntryType.CREDIT_TOP_UP,
        },
        orderBy: { createdAt: 'desc' },
      }),
      topUp.providerPaymentId
        ? this.prisma.transaction.findFirst({
            where: {
              userId,
              tipo: 'CARGA_SALDO',
              providerPaymentId: topUp.providerPaymentId,
            },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve(null),
    ]);

    return {
      topUpSessionId: topUp.id,
      provider: topUp.provider,
      amount: Number(transaction?.monto ?? topUp.amount),
      creditedAmount: Number(topUp.creditedAmount || topUp.amount),
      status: topUp.status,
      statusDetail: topUp.statusDetail,
      providerPaymentId: topUp.providerPaymentId,
      providerOrderId: topUp.providerOrderId,
      receiptVersion: topUp.receiptVersion ?? 1,
      createdAt: topUp.createdAt,
      approvedAt: topUp.approvedAt,
      receiptIssuedAt: topUp.receiptIssuedAt,
      creditBalanceAfter:
        ledgerEntry?.creditBalanceAfter === null ||
        ledgerEntry?.creditBalanceAfter === undefined
          ? null
          : Number(ledgerEntry.creditBalanceAfter),
    };
  }

  async ensureWalletAccount(tx: PrismaClientLike, userId: string) {
    return tx.walletAccount.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async creditUserBalance(
    tx: PrismaClientLike,
    userId: string,
    amount: number,
    type: WalletLedgerEntryType,
    context: LedgerContext,
  ) {
    const normalizedAmount = this.normalizePositiveAmount(amount);
    const wallet = await this.ensureWalletAccount(tx, userId);
    const updated = await tx.walletAccount.update({
      where: { id: wallet.id },
      data: {
        creditBalance: { increment: normalizedAmount },
      },
    });

    await this.createLedgerEntry(tx, {
      walletAccountId: updated.id,
      userId,
      type,
      amount: normalizedAmount,
      creditBalanceAfter: updated.creditBalance,
      sellerPayableBalanceAfter: updated.sellerPayableBalance,
      context,
    });

    return updated;
  }

  async debitUserBalance(
    tx: PrismaClientLike,
    userId: string,
    amount: number,
    type: WalletLedgerEntryType,
    context: LedgerContext,
  ) {
    const normalizedAmount = this.normalizePositiveAmount(amount);
    const wallet = await this.ensureWalletAccount(tx, userId);
    const currentBalance = Number(wallet.creditBalance);

    if (currentBalance + 0.00001 < normalizedAmount) {
      throw new BadRequestException('Saldo LUK insuficiente');
    }

    const updated = await tx.walletAccount.update({
      where: { id: wallet.id },
      data: {
        creditBalance: { decrement: normalizedAmount },
      },
    });

    await this.createLedgerEntry(tx, {
      walletAccountId: updated.id,
      userId,
      type,
      amount: -normalizedAmount,
      creditBalanceAfter: updated.creditBalance,
      sellerPayableBalanceAfter: updated.sellerPayableBalance,
      context,
    });

    return updated;
  }

  async creditSellerPayable(
    tx: PrismaClientLike,
    sellerId: string,
    amount: number,
    context: LedgerContext,
  ) {
    const normalizedAmount = this.normalizePositiveAmount(amount);
    const wallet = await this.ensureWalletAccount(tx, sellerId);
    const updated = await tx.walletAccount.update({
      where: { id: wallet.id },
      data: {
        sellerPayableBalance: { increment: normalizedAmount },
      },
    });

    await this.createLedgerEntry(tx, {
      walletAccountId: updated.id,
      userId: sellerId,
      type: WalletLedgerEntryType.SELLER_PAYABLE_CREDIT,
      amount: normalizedAmount,
      creditBalanceAfter: updated.creditBalance,
      sellerPayableBalanceAfter: updated.sellerPayableBalance,
      context,
    });

    return updated;
  }

  async debitSellerPayable(
    tx: PrismaClientLike,
    sellerId: string,
    amount: number,
    context: LedgerContext,
  ) {
    const normalizedAmount = this.normalizePositiveAmount(amount);
    const wallet = await this.ensureWalletAccount(tx, sellerId);
    const currentPayable = Number(wallet.sellerPayableBalance);

    if (currentPayable + 0.00001 < normalizedAmount) {
      throw new BadRequestException(
        'El balance interno del vendedor no alcanza para este ajuste',
      );
    }

    const updated = await tx.walletAccount.update({
      where: { id: wallet.id },
      data: {
        sellerPayableBalance: { decrement: normalizedAmount },
      },
    });

    await this.createLedgerEntry(tx, {
      walletAccountId: updated.id,
      userId: sellerId,
      type: WalletLedgerEntryType.SELLER_PAYABLE_DEBIT,
      amount: -normalizedAmount,
      creditBalanceAfter: updated.creditBalance,
      sellerPayableBalanceAfter: updated.sellerPayableBalance,
      context,
    });

    return updated;
  }

  private async createLedgerEntry(
    tx: PrismaClientLike,
    input: {
      walletAccountId: string;
      userId: string;
      type: WalletLedgerEntryType;
      amount: number;
      creditBalanceAfter: Prisma.Decimal;
      sellerPayableBalanceAfter: Prisma.Decimal;
      context: LedgerContext;
    },
  ) {
    await tx.walletLedgerEntry.create({
      data: {
        walletAccountId: input.walletAccountId,
        userId: input.userId,
        type: input.type,
        amount: input.amount,
        creditBalanceAfter: input.creditBalanceAfter,
        sellerPayableBalanceAfter: input.sellerPayableBalanceAfter,
        raffleId: input.context.raffleId ?? null,
        creditTopUpSessionId: input.context.creditTopUpSessionId ?? null,
        payoutId: input.context.payoutId ?? null,
        metadata: input.context.metadata ?? Prisma.JsonNull,
      },
    });
  }

  private normalizePositiveAmount(amount: number): number {
    const normalized = Math.round(amount * 100) / 100;
    if (!Number.isFinite(normalized) || normalized <= 0) {
      throw new BadRequestException('El monto debe ser mayor a cero');
    }
    return normalized;
  }

  private toWalletEntity(wallet: {
    id: string;
    userId: string;
    creditBalance: Prisma.Decimal;
    sellerPayableBalance: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...wallet,
      creditBalance: Number(wallet.creditBalance),
      sellerPayableBalance: Number(wallet.sellerPayableBalance),
    };
  }

  private toLedgerEntity(entry: {
    id: string;
    userId: string;
    type: WalletLedgerEntryType;
    amount: Prisma.Decimal;
    creditBalanceAfter: Prisma.Decimal | null;
    sellerPayableBalanceAfter: Prisma.Decimal | null;
    raffleId: string | null;
    creditTopUpSessionId: string | null;
    createdAt: Date;
    creditTopUpSession?: {
      receiptVersion: number | null;
    } | null;
  }) {
    return {
      ...entry,
      amount: Number(entry.amount),
      creditBalanceAfter:
        entry.creditBalanceAfter === null
          ? null
          : Number(entry.creditBalanceAfter),
      sellerPayableBalanceAfter:
        entry.sellerPayableBalanceAfter === null
          ? null
          : Number(entry.sellerPayableBalanceAfter),
      topUpReceiptAvailable:
        entry.creditTopUpSession?.receiptVersion === 1 ? true : null,
    };
  }
}

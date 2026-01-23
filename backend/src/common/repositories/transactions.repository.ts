import { Injectable } from '@nestjs/common';
import {
  Prisma,
  Transaction,
  TransactionType,
  TransactionStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from './base.repository';

/**
 * Repository for Transaction entity operations.
 * Provides type-safe database operations for transactions.
 */
@Injectable()
export class TransactionsRepository extends BaseRepository<
  Transaction,
  Prisma.TransactionCreateInput,
  Prisma.TransactionUpdateInput,
  Prisma.TransactionWhereInput,
  Prisma.TransactionOrderByWithRelationInput,
  Prisma.TransactionInclude
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.transaction;
  }

  /**
   * Find transactions by user.
   */
  async findByUser(
    userId: string,
    options?: {
      type?: TransactionType;
      status?: TransactionStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: {
        userId,
        tipo: options?.type,
        estado: options?.status,
        isDeleted: false,
      },
      include: { raffle: true },
      take: options?.limit,
      skip: options?.offset,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find transactions by raffle.
   */
  async findByRaffle(
    raffleId: string,
    type?: TransactionType,
  ): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: {
        raffleId,
        tipo: type,
        isDeleted: false,
      },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find transaction by MP payment ID.
   */
  async findByMpPaymentId(mpPaymentId: string): Promise<Transaction | null> {
    return this.prisma.transaction.findFirst({
      where: { mpPaymentId },
      include: { user: true, raffle: true },
    });
  }

  /**
   * Create a ticket purchase transaction.
   */
  async createTicketPurchase(data: {
    userId: string;
    raffleId: string;
    monto: number;
    comisionPlataforma: number;
    feeProcesamiento: number;
    montoNeto: number;
    mpPaymentId?: string;
    mpMerchantOrderId?: string;
  }): Promise<Transaction> {
    return this.prisma.transaction.create({
      data: {
        tipo: 'COMPRA_TICKET',
        estado: 'PENDIENTE',
        userId: data.userId,
        raffleId: data.raffleId,
        monto: data.monto,
        comisionPlataforma: data.comisionPlataforma,
        feeProcesamiento: data.feeProcesamiento,
        montoNeto: data.montoNeto,
        mpPaymentId: data.mpPaymentId,
        mpMerchantOrderId: data.mpMerchantOrderId,
      },
    });
  }

  /**
   * Create a refund transaction.
   */
  async createRefund(data: {
    userId: string;
    raffleId: string;
    monto: number;
    mpPaymentId?: string;
    metadata?: Prisma.JsonValue;
  }): Promise<Transaction> {
    return this.prisma.transaction.create({
      data: {
        tipo: 'REEMBOLSO',
        estado: 'COMPLETADO',
        userId: data.userId,
        raffleId: data.raffleId,
        monto: data.monto,
        mpPaymentId: data.mpPaymentId,
        metadata: data.metadata ?? undefined,
      },
    });
  }

  /**
   * Create a seller payout transaction.
   */
  async createSellerPayout(data: {
    userId: string;
    raffleId: string;
    monto: number;
    comisionPlataforma: number;
    feeProcesamiento: number;
    montoNeto: number;
  }): Promise<Transaction> {
    return this.prisma.transaction.create({
      data: {
        tipo: 'PAGO_VENDEDOR',
        estado: 'PENDIENTE',
        userId: data.userId,
        raffleId: data.raffleId,
        monto: data.monto,
        comisionPlataforma: data.comisionPlataforma,
        feeProcesamiento: data.feeProcesamiento,
        montoNeto: data.montoNeto,
      },
    });
  }

  /**
   * Update transaction status.
   */
  async updateStatus(
    id: string,
    status: TransactionStatus,
  ): Promise<Transaction> {
    return this.prisma.transaction.update({
      where: { id },
      data: { estado: status },
    });
  }

  /**
   * Get total revenue for a seller.
   */
  async getTotalRevenue(sellerId: string): Promise<number> {
    const result = await this.prisma.transaction.aggregate({
      where: {
        tipo: 'COMPRA_TICKET',
        estado: 'COMPLETADO',
        raffle: { sellerId },
        isDeleted: false,
      },
      _sum: { monto: true },
    });

    return Number(result._sum.monto || 0);
  }

  /**
   * Get transaction summary by type.
   */
  async getSummaryByType(options?: {
    userId?: string;
    raffleId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Array<{ type: TransactionType; count: number; total: number }>> {
    const where: Prisma.TransactionWhereInput = {
      isDeleted: false,
      userId: options?.userId,
      raffleId: options?.raffleId,
    };

    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const result = await this.prisma.transaction.groupBy({
      by: ['tipo'],
      where,
      _count: true,
      _sum: { monto: true },
    });

    return result.map((r) => ({
      type: r.tipo,
      count: r._count,
      total: Number(r._sum.monto || 0),
    }));
  }
}

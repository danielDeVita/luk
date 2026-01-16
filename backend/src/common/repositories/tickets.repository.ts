import { Injectable } from '@nestjs/common';
import { Prisma, Ticket, TicketStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from './base.repository';

/**
 * Ticket with common relations.
 */
export type TicketWithRelations = Ticket & {
  buyer?: any;
  raffle?: any;
};

/**
 * Repository for Ticket entity operations.
 * Provides type-safe database operations for tickets.
 */
@Injectable()
export class TicketsRepository extends BaseRepository<
  Ticket,
  Prisma.TicketCreateInput,
  Prisma.TicketUpdateInput,
  Prisma.TicketWhereInput,
  Prisma.TicketOrderByWithRelationInput,
  Prisma.TicketInclude
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.ticket;
  }

  /**
   * Find tickets by raffle.
   */
  async findByRaffle(
    raffleId: string,
    options?: {
      status?: TicketStatus;
      includeDeleted?: boolean;
    },
  ): Promise<Ticket[]> {
    return this.prisma.ticket.findMany({
      where: {
        raffleId,
        estado: options?.status,
        isDeleted: options?.includeDeleted ? undefined : false,
      },
      include: { buyer: true },
      orderBy: { numeroTicket: 'asc' },
    });
  }

  /**
   * Find paid tickets for a raffle (for drawing).
   */
  async findPaidByRaffle(raffleId: string): Promise<TicketWithRelations[]> {
    return this.prisma.ticket.findMany({
      where: {
        raffleId,
        estado: 'PAGADO',
        isDeleted: false,
      },
      include: { buyer: true, raffle: true },
    });
  }

  /**
   * Find tickets by buyer.
   */
  async findByBuyer(
    buyerId: string,
    options?: {
      status?: TicketStatus;
      raffleId?: string;
      includeDeleted?: boolean;
    },
  ): Promise<TicketWithRelations[]> {
    return this.prisma.ticket.findMany({
      where: {
        buyerId,
        raffleId: options?.raffleId,
        estado: options?.status,
        isDeleted: options?.includeDeleted ? undefined : false,
      },
      include: { raffle: { include: { product: true } } },
      orderBy: { fechaCompra: 'desc' },
    });
  }

  /**
   * Find ticket by MP payment ID.
   */
  async findByMpPaymentId(mpPaymentId: string): Promise<Ticket | null> {
    return this.prisma.ticket.findFirst({
      where: { mpPaymentId },
      include: { buyer: true, raffle: true },
    });
  }

  /**
   * Count tickets for a raffle by status.
   */
  async countByRaffleAndStatus(
    raffleId: string,
    status?: TicketStatus,
  ): Promise<number> {
    return this.prisma.ticket.count({
      where: {
        raffleId,
        estado: status,
        isDeleted: false,
      },
    });
  }

  /**
   * Get ticket numbers already taken for a raffle.
   */
  async getTakenNumbers(raffleId: string): Promise<number[]> {
    const tickets = await this.prisma.ticket.findMany({
      where: {
        raffleId,
        estado: { in: ['RESERVADO', 'PAGADO'] },
        isDeleted: false,
      },
      select: { numeroTicket: true },
    });

    return tickets.map((t) => t.numeroTicket);
  }

  /**
   * Create multiple tickets at once.
   */
  async createMany(
    raffleId: string,
    buyerId: string,
    ticketNumbers: number[],
    precioPagado: number,
    mpExternalReference?: string,
  ): Promise<Ticket[]> {
    const createData = ticketNumbers.map((numero) => ({
      raffleId,
      buyerId,
      numeroTicket: numero,
      precioPagado,
      estado: 'RESERVADO' as TicketStatus,
      mpExternalReference,
    }));

    await this.prisma.ticket.createMany({
      data: createData,
    });

    return this.prisma.ticket.findMany({
      where: {
        raffleId,
        buyerId,
        numeroTicket: { in: ticketNumbers },
      },
    });
  }

  /**
   * Update ticket status by external reference (batch).
   */
  async updateStatusByExternalReference(
    mpExternalReference: string,
    status: TicketStatus,
    mpPaymentId?: string,
  ): Promise<number> {
    const result = await this.prisma.ticket.updateMany({
      where: { mpExternalReference },
      data: {
        estado: status,
        mpPaymentId,
      },
    });

    return result.count;
  }

  /**
   * Mark tickets as refunded.
   */
  async markAsRefunded(ticketIds: string[]): Promise<number> {
    const result = await this.prisma.ticket.updateMany({
      where: { id: { in: ticketIds } },
      data: { estado: 'REEMBOLSADO' },
    });

    return result.count;
  }

  /**
   * Get buyer ticket count for a raffle (for max ticket validation).
   */
  async getBuyerTicketCount(
    raffleId: string,
    buyerId: string,
  ): Promise<number> {
    return this.prisma.ticket.count({
      where: {
        raffleId,
        buyerId,
        estado: { in: ['RESERVADO', 'PAGADO'] },
        isDeleted: false,
      },
    });
  }

  /**
   * Get available ticket numbers for a raffle.
   */
  async getAvailableNumbers(
    raffleId: string,
    totalTickets: number,
  ): Promise<number[]> {
    const taken = await this.getTakenNumbers(raffleId);
    const takenSet = new Set(taken);

    const available: number[] = [];
    for (let i = 1; i <= totalTickets; i++) {
      if (!takenSet.has(i)) {
        available.push(i);
      }
    }

    return available;
  }

  /**
   * Soft delete tickets for a raffle.
   */
  async softDeleteByRaffle(raffleId: string): Promise<number> {
    const result = await this.prisma.ticket.updateMany({
      where: { raffleId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return result.count;
  }
}

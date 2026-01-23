import { Injectable } from '@nestjs/common';
import {
  Prisma,
  Dispute,
  DisputeStatus,
  DisputeType,
  Raffle,
  User,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from './base.repository';

/**
 * Dispute with common relations.
 */
export type DisputeWithRelations = Dispute & {
  raffle?: Raffle;
  reporter?: User;
};

/**
 * Repository for Dispute entity operations.
 * Provides type-safe database operations for disputes.
 */
@Injectable()
export class DisputesRepository extends BaseRepository<
  Dispute,
  Prisma.DisputeCreateInput,
  Prisma.DisputeUpdateInput,
  Prisma.DisputeWhereInput,
  Prisma.DisputeOrderByWithRelationInput,
  Prisma.DisputeInclude
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.dispute;
  }

  /**
   * Default includes for dispute queries.
   */
  static readonly defaultInclude: Prisma.DisputeInclude = {
    raffle: { include: { seller: true, product: true } },
    reporter: true,
  };

  /**
   * Find dispute by raffle (1:1 relationship).
   */
  async findByRaffle(raffleId: string): Promise<DisputeWithRelations | null> {
    return this.prisma.dispute.findUnique({
      where: { raffleId },
      include: DisputesRepository.defaultInclude,
    });
  }

  /**
   * Find disputes reported by a user.
   */
  async findByReporter(
    reporterId: string,
    options?: { status?: DisputeStatus },
  ): Promise<DisputeWithRelations[]> {
    return this.prisma.dispute.findMany({
      where: {
        reporterId,
        estado: options?.status,
        isDeleted: false,
      },
      include: DisputesRepository.defaultInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find disputes involving a seller.
   */
  async findBySeller(
    sellerId: string,
    options?: { status?: DisputeStatus },
  ): Promise<DisputeWithRelations[]> {
    return this.prisma.dispute.findMany({
      where: {
        raffle: { sellerId },
        estado: options?.status,
        isDeleted: false,
      },
      include: DisputesRepository.defaultInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find open disputes (for admin review).
   */
  async findOpen(): Promise<DisputeWithRelations[]> {
    return this.prisma.dispute.findMany({
      where: {
        estado: {
          in: ['ABIERTA', 'ESPERANDO_RESPUESTA_VENDEDOR', 'EN_MEDIACION'],
        },
        isDeleted: false,
      },
      include: DisputesRepository.defaultInclude,
      orderBy: { createdAt: 'asc' }, // Oldest first
    });
  }

  /**
   * Find disputes by status.
   */
  async findByStatus(status: DisputeStatus): Promise<DisputeWithRelations[]> {
    return this.prisma.dispute.findMany({
      where: {
        estado: status,
        isDeleted: false,
      },
      include: DisputesRepository.defaultInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a new dispute.
   */
  async createDispute(data: {
    raffleId: string;
    reporterId: string;
    tipo: DisputeType;
    titulo: string;
    descripcion: string;
    evidencias?: string[];
  }): Promise<DisputeWithRelations> {
    return this.prisma.dispute.create({
      data: {
        raffleId: data.raffleId,
        reporterId: data.reporterId,
        tipo: data.tipo,
        titulo: data.titulo,
        descripcion: data.descripcion,
        evidencias: data.evidencias || [],
        estado: 'ABIERTA',
      },
      include: DisputesRepository.defaultInclude,
    });
  }

  /**
   * Add seller response to dispute.
   */
  async addSellerResponse(
    disputeId: string,
    response: string,
    evidencias?: string[],
  ): Promise<Dispute> {
    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        respuestaVendedor: response,
        evidenciasVendedor: evidencias || [],
        fechaRespuestaVendedor: new Date(),
        estado: 'EN_MEDIACION',
      },
    });
  }

  /**
   * Update dispute status.
   */
  async updateStatus(
    disputeId: string,
    status: DisputeStatus,
  ): Promise<Dispute> {
    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: { estado: status },
    });
  }

  /**
   * Resolve dispute.
   */
  async resolve(
    disputeId: string,
    data: {
      status: DisputeStatus;
      resolucion: string;
      adminNotes?: string;
      montoReembolsado?: number;
      montoPagadoVendedor?: number;
    },
  ): Promise<Dispute> {
    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        estado: data.status,
        resolucion: data.resolucion,
        adminNotes: data.adminNotes,
        montoReembolsado: data.montoReembolsado,
        montoPagadoVendedor: data.montoPagadoVendedor,
        resolvedAt: new Date(),
      },
    });
  }

  /**
   * Count disputes by status.
   */
  async countByStatus(): Promise<Record<DisputeStatus, number>> {
    const statuses: DisputeStatus[] = [
      'ABIERTA',
      'ESPERANDO_RESPUESTA_VENDEDOR',
      'EN_MEDIACION',
      'RESUELTA_COMPRADOR',
      'RESUELTA_VENDEDOR',
      'RESUELTA_PARCIAL',
    ];

    const counts = await Promise.all(
      statuses.map((status) =>
        this.prisma.dispute.count({
          where: { estado: status, isDeleted: false },
        }),
      ),
    );

    return statuses.reduce(
      (acc, status, index) => {
        acc[status] = counts[index];
        return acc;
      },
      {} as Record<DisputeStatus, number>,
    );
  }

  /**
   * Get dispute statistics for a seller.
   */
  async getSellerStats(sellerId: string): Promise<{
    total: number;
    won: number;
    lost: number;
    pending: number;
  }> {
    const disputes = await this.prisma.dispute.findMany({
      where: {
        raffle: { sellerId },
        isDeleted: false,
      },
      select: { estado: true },
    });

    const stats = {
      total: disputes.length,
      won: 0,
      lost: 0,
      pending: 0,
    };

    for (const d of disputes) {
      if (d.estado === 'RESUELTA_VENDEDOR') {
        stats.won++;
      } else if (d.estado === 'RESUELTA_COMPRADOR') {
        stats.lost++;
      } else if (
        ['ABIERTA', 'ESPERANDO_RESPUESTA_VENDEDOR', 'EN_MEDIACION'].includes(
          d.estado,
        )
      ) {
        stats.pending++;
      }
    }

    return stats;
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma, Raffle, RaffleStatus, DeliveryStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from './base.repository';

/**
 * Full raffle type with common relations.
 */
export type RaffleWithRelations = Raffle & {
  product?: any;
  seller?: any;
  winner?: any;
  tickets?: any[];
};

/**
 * Repository for Raffle entity operations.
 * Provides type-safe database operations for raffles.
 */
@Injectable()
export class RafflesRepository extends BaseRepository<
  Raffle,
  Prisma.RaffleCreateInput,
  Prisma.RaffleUpdateInput,
  Prisma.RaffleWhereInput,
  Prisma.RaffleOrderByWithRelationInput,
  Prisma.RaffleInclude
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.raffle;
  }

  /**
   * Default includes for raffle queries.
   */
  static readonly defaultInclude: Prisma.RaffleInclude = {
    product: true,
    seller: true,
    tickets: true,
  };

  /**
   * Full includes for detailed raffle views.
   */
  static readonly fullInclude: Prisma.RaffleInclude = {
    product: true,
    seller: true,
    tickets: { include: { buyer: true } },
    winner: true,
    dispute: true,
    category: true,
  };

  /**
   * Find a raffle with all relations.
   */
  async findByIdWithRelations(id: string): Promise<RaffleWithRelations | null> {
    return this.prisma.raffle.findUnique({
      where: { id },
      include: RafflesRepository.fullInclude,
    });
  }

  /**
   * Find all raffles by seller.
   */
  async findBySeller(
    sellerId: string,
    options?: {
      status?: RaffleStatus;
      includeDeleted?: boolean;
      orderBy?: Prisma.RaffleOrderByWithRelationInput;
    },
  ): Promise<Raffle[]> {
    return this.prisma.raffle.findMany({
      where: {
        sellerId,
        estado: options?.status,
        isDeleted: options?.includeDeleted ? undefined : false,
      },
      include: RafflesRepository.defaultInclude,
      orderBy: options?.orderBy || { createdAt: 'desc' },
    });
  }

  /**
   * Find active raffles (for listings).
   */
  async findActive(options?: {
    categoryId?: string;
    limit?: number;
    offset?: number;
    orderBy?: Prisma.RaffleOrderByWithRelationInput;
  }): Promise<Raffle[]> {
    return this.prisma.raffle.findMany({
      where: {
        estado: 'ACTIVA',
        isHidden: false,
        isDeleted: false,
        categoryId: options?.categoryId,
      },
      include: RafflesRepository.defaultInclude,
      take: options?.limit,
      skip: options?.offset,
      orderBy: options?.orderBy || { createdAt: 'desc' },
    });
  }

  /**
   * Find expired raffles that need processing.
   */
  async findExpired(): Promise<Raffle[]> {
    return this.prisma.raffle.findMany({
      where: {
        estado: 'ACTIVA',
        fechaLimiteSorteo: { lte: new Date() },
        isDeleted: false,
      },
      include: RafflesRepository.fullInclude,
    });
  }

  /**
   * Find completed raffles awaiting draw.
   */
  async findCompletedAwaitingDraw(): Promise<Raffle[]> {
    return this.prisma.raffle.findMany({
      where: {
        estado: 'COMPLETADA',
        winnerId: null,
        isDeleted: false,
      },
      include: RafflesRepository.fullInclude,
    });
  }

  /**
   * Update raffle status.
   */
  async updateStatus(id: string, estado: RaffleStatus): Promise<Raffle> {
    return this.prisma.raffle.update({
      where: { id },
      data: { estado },
      include: RafflesRepository.defaultInclude,
    });
  }

  /**
   * Set winner for a raffle.
   */
  async setWinner(id: string, winnerId: string): Promise<Raffle> {
    return this.prisma.raffle.update({
      where: { id },
      data: {
        winnerId,
        estado: 'SORTEADA',
        fechaSorteoReal: new Date(),
      },
      include: RafflesRepository.fullInclude,
    });
  }

  /**
   * Update delivery status.
   */
  async updateDeliveryStatus(
    id: string,
    status: DeliveryStatus,
    data?: { trackingNumber?: string },
  ): Promise<Raffle> {
    const updateData: Prisma.RaffleUpdateInput = {
      deliveryStatus: status,
      trackingNumber: data?.trackingNumber,
    };

    if (status === 'SHIPPED') {
      updateData.shippedAt = new Date();
    } else if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date();
    } else if (status === 'CONFIRMED') {
      updateData.confirmedAt = new Date();
      updateData.paymentReleasedAt = new Date();
      updateData.estado = 'FINALIZADA';
    }

    return this.prisma.raffle.update({
      where: { id },
      data: updateData,
      include: RafflesRepository.fullInclude,
    });
  }

  /**
   * Increment view count.
   */
  async incrementViewCount(id: string): Promise<Raffle> {
    return this.prisma.raffle.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
  }

  /**
   * Hide/unhide a raffle (moderation).
   */
  async setHidden(id: string, hidden: boolean, reason?: string): Promise<Raffle> {
    return this.prisma.raffle.update({
      where: { id },
      data: {
        isHidden: hidden,
        hiddenReason: reason || null,
      },
    });
  }

  /**
   * Soft delete a raffle.
   */
  async softDelete(id: string): Promise<Raffle> {
    return this.prisma.raffle.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Count raffles by status.
   */
  async countByStatus(sellerId?: string): Promise<Record<RaffleStatus, number>> {
    const statuses: RaffleStatus[] = [
      'ACTIVA',
      'COMPLETADA',
      'SORTEADA',
      'EN_ENTREGA',
      'FINALIZADA',
      'CANCELADA',
    ];

    const counts = await Promise.all(
      statuses.map((status) =>
        this.prisma.raffle.count({
          where: {
            estado: status,
            sellerId,
            isDeleted: false,
          },
        }),
      ),
    );

    return statuses.reduce(
      (acc, status, index) => {
        acc[status] = counts[index];
        return acc;
      },
      {} as Record<RaffleStatus, number>,
    );
  }

  /**
   * Find raffles user has tickets for.
   */
  async findByParticipant(userId: string): Promise<Raffle[]> {
    return this.prisma.raffle.findMany({
      where: {
        tickets: {
          some: {
            buyerId: userId,
            estado: 'PAGADO',
          },
        },
        isDeleted: false,
      },
      include: RafflesRepository.defaultInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find raffles user has won.
   */
  async findWonByUser(userId: string): Promise<Raffle[]> {
    return this.prisma.raffle.findMany({
      where: {
        winnerId: userId,
        isDeleted: false,
      },
      include: RafflesRepository.fullInclude,
      orderBy: { fechaSorteoReal: 'desc' },
    });
  }
}

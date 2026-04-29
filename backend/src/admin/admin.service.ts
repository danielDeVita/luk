import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { EncryptionService } from '../common/services/encryption.service';
import { NotificationsService } from '../notifications/notifications.service';

interface UserFilters {
  role?: UserRole;
  search?: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

interface AdminReviewFilters {
  includeHidden?: boolean;
  limit?: number;
  offset?: number;
}

interface PaymentProviderEventFilters {
  eventType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

interface TransactionFilters {
  userId?: string;
  raffleId?: string;
  tipo?: string;
  estado?: string;
  providerPaymentId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private notificationsService: NotificationsService,
  ) {}

  // ==================== Payment Provider Event Viewer ====================

  async getPaymentProviderEvents(filters: PaymentProviderEventFilters) {
    const where: Record<string, unknown> = {};

    if (filters.eventType) {
      where.eventType = { contains: filters.eventType };
    }

    if (filters.startDate || filters.endDate) {
      where.processedAt = {};
      if (filters.startDate)
        (where.processedAt as Record<string, Date>).gte = filters.startDate;
      if (filters.endDate)
        (where.processedAt as Record<string, Date>).lte = filters.endDate;
    }

    const [events, total] = await Promise.all([
      this.prisma.paymentProviderEvent.findMany({
        where,
        orderBy: { processedAt: 'desc' },
        take: filters.limit ?? 50,
        skip: filters.offset ?? 0,
      }),
      this.prisma.paymentProviderEvent.count({ where }),
    ]);

    return { events, total };
  }

  async getPaymentProviderEventById(eventId: string) {
    return this.prisma.paymentProviderEvent.findUnique({
      where: { eventId },
    });
  }

  // ==================== Transaction Debug Queries ====================

  async getTransactions(filters: TransactionFilters) {
    const where: Record<string, unknown> = { isDeleted: false };

    if (filters.userId) where.userId = filters.userId;
    if (filters.raffleId) where.raffleId = filters.raffleId;
    if (filters.tipo) where.tipo = filters.tipo;
    if (filters.estado) where.estado = filters.estado;
    if (filters.providerPaymentId)
      where.providerPaymentId = filters.providerPaymentId;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate)
        (where.createdAt as Record<string, Date>).gte = filters.startDate;
      if (filters.endDate)
        (where.createdAt as Record<string, Date>).lte = filters.endDate;
    }

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, nombre: true, apellido: true },
          },
          raffle: { select: { id: true, titulo: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit ?? 50,
        skip: filters.offset ?? 0,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { transactions, total };
  }

  async getTransactionByMpPaymentId(providerPaymentId: string) {
    return this.prisma.transaction.findFirst({
      where: { providerPaymentId, isDeleted: false },
      include: {
        user: {
          select: { id: true, email: true, nombre: true, apellido: true },
        },
        raffle: { select: { id: true, titulo: true, sellerId: true } },
      },
    });
  }

  // ==================== Payment Debug Summary ====================

  async getPaymentDebugInfo(providerPaymentId: string) {
    const [providerEvent, transaction] = await Promise.all([
      this.prisma.paymentProviderEvent.findFirst({
        where: { eventId: providerPaymentId },
      }),
      this.prisma.transaction.findFirst({
        where: { providerPaymentId, isDeleted: false },
        include: {
          user: { select: { id: true, email: true, nombre: true } },
          raffle: { select: { id: true, titulo: true, sellerId: true } },
        },
      }),
    ]);

    return {
      providerPaymentId,
      webhookReceived: !!providerEvent,
      webhookProcessedAt: providerEvent?.processedAt,
      webhookEventType: providerEvent?.eventType,
      transactionCreated: !!transaction,
      transactionId: transaction?.id,
      transactionStatus: transaction?.estado,
      transactionAmount: transaction?.monto,
      ticketsCount: 0,
      tickets: [],
      raffle: transaction?.raffle ?? undefined,
      buyer: transaction?.user,
    };
  }

  // ==================== Stats ====================

  async getAdminStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalRaffles,
      activeRaffles,
      completedRaffles,
      totalTransactions,
      totalDisputes,
      pendingDisputes,
      recentPaymentEvents,
      newUsersToday,
      newRafflesToday,
      ticketStats,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.raffle.count(),
      this.prisma.raffle.count({ where: { estado: 'ACTIVA' } }),
      this.prisma.raffle.count({ where: { estado: 'FINALIZADA' } }),
      this.prisma.transaction.count({ where: { isDeleted: false } }),
      this.prisma.dispute.count(),
      this.prisma.dispute.count({ where: { estado: 'ABIERTA' } }),
      this.prisma.paymentProviderEvent.count({
        where: {
          processedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: todayStart } },
      }),
      this.prisma.raffle.count({
        where: { createdAt: { gte: todayStart } },
      }),
      this.prisma.ticket.aggregate({
        where: { estado: 'PAGADO' },
        _count: { id: true },
        _sum: { precioPagado: true },
      }),
    ]);

    return {
      totalUsers,
      totalRaffles,
      activeRaffles,
      completedRaffles,
      totalTransactions,
      totalRevenue: Number(ticketStats._sum.precioPagado || 0),
      totalTicketsSold: ticketStats._count.id || 0,
      totalDisputes,
      pendingDisputes,
      recentPaymentEvents,
      newUsersToday,
      newRafflesToday,
    };
  }

  // ==================== User Management ====================

  async getUsers(filters: UserFilters) {
    const where: Record<string, unknown> = {};

    if (filters.role) {
      where.role = filters.role;
    }

    if (!filters.includeDeleted) {
      where.isDeleted = false;
    }

    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { nombre: { contains: filters.search, mode: 'insensitive' } },
        { apellido: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit ?? 50,
        skip: filters.offset ?? 0,
        include: {
          reputation: true,
          _count: {
            select: {
              rafflesCreated: true,
              ticketsPurchased: true,
              rafflesWon: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        nombre: u.nombre,
        apellido: u.apellido,
        role: u.role,
        sellerPaymentAccountStatus: u.sellerPaymentAccountStatus,
        kycStatus: u.kycStatus,
        createdAt: u.createdAt,
        isDeleted: u.isDeleted,
        rafflesCreated: u._count.rafflesCreated,
        ticketsPurchased: u._count.ticketsPurchased,
        rafflesWon: u._count.rafflesWon,
        totalTicketsComprados:
          u.reputation?.totalTicketsComprados ?? u._count.ticketsPurchased,
        totalRifasGanadas:
          u.reputation?.totalRifasGanadas ?? u._count.rafflesWon,
        totalComprasCompletadas: u.reputation?.totalComprasCompletadas ?? 0,
        disputasComoCompradorAbiertas:
          u.reputation?.disputasComoCompradorAbiertas ?? 0,
        buyerRiskFlags: this.buildBuyerRiskFlags({
          createdAt: u.createdAt,
          totalTicketsComprados:
            u.reputation?.totalTicketsComprados ?? u._count.ticketsPurchased,
          totalRifasGanadas:
            u.reputation?.totalRifasGanadas ?? u._count.rafflesWon,
          totalComprasCompletadas: u.reputation?.totalComprasCompletadas ?? 0,
          disputasComoCompradorAbiertas:
            u.reputation?.disputasComoCompradorAbiertas ?? 0,
        }),
      })),
      total,
    };
  }

  async getReviews(filters: AdminReviewFilters = {}) {
    const where = filters.includeHidden ? {} : { commentHidden: false };
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit ?? 50,
        skip: filters.offset ?? 0,
        include: {
          seller: { select: { nombre: true, apellido: true, email: true } },
          reviewer: { select: { nombre: true, apellido: true, email: true } },
          raffle: { select: { titulo: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      reviews: reviews.map((review) => this.toAdminReview(review)),
      total,
    };
  }

  async hideReviewComment(reviewId: string, adminId: string, reason: string) {
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      throw new BadRequestException('Moderation reason is required');
    }

    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true },
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const updatedReview = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        commentHidden: true,
        commentHiddenReason: normalizedReason,
        commentHiddenAt: new Date(),
        commentHiddenById: adminId,
      },
      include: {
        seller: { select: { nombre: true, apellido: true, email: true } },
        reviewer: { select: { nombre: true, apellido: true, email: true } },
        raffle: { select: { titulo: true } },
      },
    });

    return this.toAdminReview(updatedReview);
  }

  private buildBuyerRiskFlags(input: {
    createdAt: Date;
    totalTicketsComprados: number;
    totalRifasGanadas: number;
    totalComprasCompletadas: number;
    disputasComoCompradorAbiertas: number;
  }): string[] {
    const flags: string[] = [];
    const accountAgeDays =
      (Date.now() - input.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const disputeRatio =
      input.disputasComoCompradorAbiertas /
      Math.max(input.totalComprasCompletadas, 1);

    if (input.disputasComoCompradorAbiertas >= 2 && disputeRatio >= 0.5) {
      flags.push('HIGH_DISPUTE_RATE');
    }
    if (accountAgeDays <= 30 && input.disputasComoCompradorAbiertas > 0) {
      flags.push('NEW_WITH_DISPUTE');
    }
    if (input.totalTicketsComprados >= 50) {
      flags.push('HEAVY_BUYER');
    }
    if (
      input.totalRifasGanadas > 0 &&
      input.totalComprasCompletadas > 0 &&
      input.disputasComoCompradorAbiertas === 0
    ) {
      flags.push('WINNER_WITH_HISTORY');
    }

    return flags;
  }

  private toAdminReview(review: {
    id: string;
    rating: number;
    comentario: string | null;
    createdAt: Date;
    commentHidden: boolean;
    commentHiddenReason: string | null;
    seller: { nombre: string; apellido: string; email: string };
    reviewer: { nombre: string; apellido: string; email: string };
    raffle: { titulo: string };
  }) {
    return {
      id: review.id,
      rating: review.rating,
      comentario: review.commentHidden ? null : review.comentario,
      createdAt: review.createdAt,
      reviewerName: [review.reviewer.nombre, review.reviewer.apellido]
        .filter(Boolean)
        .join(' '),
      raffleTitle: review.raffle.titulo,
      sellerName: [review.seller.nombre, review.seller.apellido]
        .filter(Boolean)
        .join(' '),
      sellerEmail: review.seller.email,
      reviewerEmail: review.reviewer.email,
      commentHidden: review.commentHidden,
      commentHiddenReason: review.commentHiddenReason,
    };
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        reputation: true,
        _count: {
          select: {
            rafflesCreated: true,
            ticketsPurchased: true,
            rafflesWon: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async banUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) throw new Error('Cannot ban an admin');

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.BANNED },
    });
  }

  async unbanUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.USER },
    });
  }

  async getUserActivity(userId: string, limit = 50, offset = 0) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  // ==================== KYC Management ====================

  async getPendingKycSubmissions(limit = 50, offset = 0) {
    const where = { kycStatus: 'PENDING_REVIEW' as const, isDeleted: false };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { kycSubmittedAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          email: true,
          nombre: true,
          apellido: true,
          kycStatus: true,
          documentType: true,
          documentNumber: true,
          street: true,
          streetNumber: true,
          apartment: true,
          city: true,
          province: true,
          postalCode: true,
          phone: true,
          cuitCuil: true,
          kycSubmittedAt: true,
          kycVerifiedAt: true,
          kycRejectedReason: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      submissions: users.map((u) => {
        // Decrypt PII fields for admin review
        const decryptedPII = this.encryptionService.decryptUserPII(u);

        return {
          userId: u.id,
          email: u.email,
          nombre: u.nombre,
          apellido: u.apellido,
          kycStatus: u.kycStatus,
          documentType: u.documentType || null,
          documentNumber: decryptedPII.documentNumber || null,
          street: decryptedPII.street || null,
          streetNumber: decryptedPII.streetNumber || null,
          apartment: decryptedPII.apartment || null,
          city: decryptedPII.city || null,
          province: decryptedPII.province || null,
          postalCode: decryptedPII.postalCode || null,
          phone: decryptedPII.phone || null,
          cuitCuil: decryptedPII.cuitCuil || null,
          kycSubmittedAt: u.kycSubmittedAt || null,
          kycVerifiedAt: u.kycVerifiedAt || null,
          kycRejectedReason: u.kycRejectedReason || null,
          createdAt: u.createdAt,
        };
      }),
      total,
    };
  }

  async approveKyc(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.kycStatus !== 'PENDING_REVIEW') {
      throw new Error('KYC is not in PENDING_REVIEW status');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: 'VERIFIED',
        kycVerifiedAt: new Date(),
        kycRejectedReason: null,
      },
      select: {
        id: true,
        kycStatus: true,
      },
    });

    // Send notification to user
    const userName = `${user.nombre} ${user.apellido}`;
    this.notifyKycApproved(user.id, user.email, userName).catch(
      (error: unknown) => {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Failed to send KYC approved notification: ${errorMsg}`,
        );
      },
    );

    return {
      userId: updated.id,
      kycStatus: updated.kycStatus,
      success: true,
      message: 'KYC verificado exitosamente',
    };
  }

  private async notifyKycApproved(
    userId: string,
    email: string,
    userName: string,
  ) {
    // Send email notification
    await this.notificationsService.sendKycApprovedNotification(email, {
      userName,
    });

    // Create in-app notification
    await this.notificationsService.create(
      userId,
      'INFO',
      '¡KYC Aprobado!',
      'Tu verificación de identidad fue aprobada. Ya podés crear rifas y recibir pagos.',
    );
  }

  async rejectKyc(userId: string, reason: string) {
    if (!reason || reason.trim().length < 10) {
      throw new Error('Rejection reason must be at least 10 characters');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.kycStatus !== 'PENDING_REVIEW') {
      throw new Error('KYC is not in PENDING_REVIEW status');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: 'REJECTED',
        kycRejectedReason: reason,
      },
      select: {
        id: true,
        kycStatus: true,
      },
    });

    // Send notification to user
    const userName = `${user.nombre} ${user.apellido}`;
    this.notifyKycRejected(user.id, user.email, userName, reason).catch(
      (error: unknown) => {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Failed to send KYC rejected notification: ${errorMsg}`,
        );
      },
    );

    return {
      userId: updated.id,
      kycStatus: updated.kycStatus,
      success: true,
      message: 'KYC rechazado',
    };
  }

  private async notifyKycRejected(
    userId: string,
    email: string,
    userName: string,
    rejectionReason: string,
  ) {
    // Send email notification
    await this.notificationsService.sendKycRejectedNotification(email, {
      userName,
      rejectionReason,
    });

    // Create in-app notification
    await this.notificationsService.create(
      userId,
      'INFO',
      'KYC Rechazado',
      `Tu verificación de identidad fue rechazada. Motivo: ${rejectionReason}`,
    );
  }
}

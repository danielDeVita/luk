import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

interface UserFilters {
  role?: UserRole;
  search?: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

interface MpEventFilters {
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
  mpPaymentId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ==================== MpEvent Viewer ====================

  async getMpEvents(filters: MpEventFilters) {
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
      this.prisma.mpEvent.findMany({
        where,
        orderBy: { processedAt: 'desc' },
        take: filters.limit ?? 50,
        skip: filters.offset ?? 0,
      }),
      this.prisma.mpEvent.count({ where }),
    ]);

    return { events, total };
  }

  async getMpEventById(eventId: string) {
    return this.prisma.mpEvent.findUnique({
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
    if (filters.mpPaymentId) where.mpPaymentId = filters.mpPaymentId;

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

  async getTransactionByMpPaymentId(mpPaymentId: string) {
    return this.prisma.transaction.findFirst({
      where: { mpPaymentId, isDeleted: false },
      include: {
        user: {
          select: { id: true, email: true, nombre: true, apellido: true },
        },
        raffle: { select: { id: true, titulo: true, sellerId: true } },
      },
    });
  }

  // ==================== Payment Debug Summary ====================

  async getPaymentDebugInfo(mpPaymentId: string) {
    const [mpEvent, transaction, tickets] = await Promise.all([
      this.prisma.mpEvent.findFirst({
        where: { eventId: mpPaymentId },
      }),
      this.prisma.transaction.findFirst({
        where: { mpPaymentId, isDeleted: false },
        include: {
          user: { select: { id: true, email: true, nombre: true } },
          raffle: { select: { id: true, titulo: true, sellerId: true } },
        },
      }),
      this.prisma.ticket.findMany({
        where: { mpPaymentId },
        select: {
          id: true,
          numeroTicket: true,
          estado: true,
          precioPagado: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      mpPaymentId,
      webhookReceived: !!mpEvent,
      webhookProcessedAt: mpEvent?.processedAt,
      webhookEventType: mpEvent?.eventType,
      transactionCreated: !!transaction,
      transactionId: transaction?.id,
      transactionStatus: transaction?.estado,
      transactionAmount: transaction?.monto,
      ticketsCount: tickets.length,
      tickets: tickets.map((t) => ({
        id: t.id,
        numeroTicket: t.numeroTicket,
        estado: t.estado,
        precioPagado: t.precioPagado,
      })),
      raffle: transaction?.raffle,
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
      recentMpEvents,
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
      this.prisma.mpEvent.count({
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
      recentMpEvents,
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
        mpConnectStatus: u.mpConnectStatus,
        kycStatus: u.kycStatus,
        createdAt: u.createdAt,
        isDeleted: u.isDeleted,
        rafflesCreated: u._count.rafflesCreated,
        ticketsPurchased: u._count.ticketsPurchased,
        rafflesWon: u._count.rafflesWon,
      })),
      total,
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
    const where = { kycStatus: 'PENDING_REVIEW' as any, isDeleted: false };

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
      submissions: users.map((u) => ({
        userId: u.id,
        email: u.email,
        nombre: u.nombre,
        apellido: u.apellido,
        kycStatus: u.kycStatus,
        documentType: u.documentType || null,
        documentNumber: u.documentNumber || null,
        street: u.street || null,
        streetNumber: u.streetNumber || null,
        apartment: u.apartment || null,
        city: u.city || null,
        province: u.province || null,
        postalCode: u.postalCode || null,
        phone: u.phone || null,
        cuitCuil: u.cuitCuil || null,
        kycSubmittedAt: u.kycSubmittedAt || null,
        kycVerifiedAt: u.kycVerifiedAt || null,
        kycRejectedReason: u.kycRejectedReason || null,
        createdAt: u.createdAt,
      })),
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

    return {
      userId: updated.id,
      kycStatus: updated.kycStatus,
      success: true,
      message: 'KYC verificado exitosamente',
    };
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

    return {
      userId: updated.id,
      kycStatus: updated.kycStatus,
      success: true,
      message: 'KYC rechazado',
    };
  }
}

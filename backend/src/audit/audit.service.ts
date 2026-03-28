import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, Prisma } from '@prisma/client';

interface CreateAuditLogParams {
  adminId: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
  reason?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async log(params: CreateAuditLogParams) {
    const auditLog = await this.prisma.auditLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        details: params.details as Prisma.InputJsonValue | undefined,
        reason: params.reason,
      },
    });

    this.logger.log(
      `Audit: ${params.action} on ${params.targetType}:${params.targetId} by admin ${params.adminId}`,
    );

    return auditLog;
  }

  async getAuditLogs(filters: {
    adminId?: string;
    action?: AuditAction;
    targetType?: string;
    targetId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};

    if (filters.adminId) where.adminId = filters.adminId;
    if (filters.action) where.action = filters.action;
    if (filters.targetType) where.targetType = filters.targetType;
    if (filters.targetId) where.targetId = filters.targetId;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate)
        (where.createdAt as Record<string, Date>).gte = filters.startDate;
      if (filters.endDate)
        (where.createdAt as Record<string, Date>).lte = filters.endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          admin: {
            select: { id: true, email: true, nombre: true, apellido: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit ?? 50,
        skip: filters.offset ?? 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  async getAuditLogsForTarget(targetType: string, targetId: string) {
    return this.prisma.auditLog.findMany({
      where: { targetType, targetId },
      include: {
        admin: { select: { id: true, email: true, nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Helper methods for common actions
  async logUserBan(adminId: string, userId: string, reason: string) {
    return this.log({
      adminId,
      action: AuditAction.USER_BANNED,
      targetType: 'User',
      targetId: userId,
      reason,
    });
  }

  async logUserUnban(adminId: string, userId: string, reason: string) {
    return this.log({
      adminId,
      action: AuditAction.USER_UNBANNED,
      targetType: 'User',
      targetId: userId,
      reason,
    });
  }

  async logRaffleHidden(adminId: string, raffleId: string, reason: string) {
    return this.log({
      adminId,
      action: AuditAction.RAFFLE_HIDDEN,
      targetType: 'Raffle',
      targetId: raffleId,
      reason,
    });
  }

  async logRaffleUnhidden(adminId: string, raffleId: string, reason: string) {
    return this.log({
      adminId,
      action: AuditAction.RAFFLE_UNHIDDEN,
      targetType: 'Raffle',
      targetId: raffleId,
      reason,
    });
  }

  async logDisputeResolved(
    adminId: string,
    disputeId: string,
    resolution: string,
    details?: Record<string, unknown>,
  ) {
    return this.log({
      adminId,
      action: AuditAction.DISPUTE_RESOLVED,
      targetType: 'Dispute',
      targetId: disputeId,
      reason: resolution,
      details,
    });
  }

  async logPayoutReleased(
    adminId: string,
    payoutId: string,
    details?: Record<string, unknown>,
  ) {
    return this.log({
      adminId,
      action: AuditAction.PAYOUT_RELEASED,
      targetType: 'Payout',
      targetId: payoutId,
      details,
    });
  }

  async logRefundIssued(
    adminId: string,
    transactionId: string,
    reason: string,
    details?: Record<string, unknown>,
  ) {
    return this.log({
      adminId,
      action: AuditAction.REFUND_ISSUED,
      targetType: 'Transaction',
      targetId: transactionId,
      reason,
      details,
    });
  }

  async logReportReviewed(
    adminId: string,
    reportId: string,
    details: Record<string, unknown>,
  ) {
    return this.log({
      adminId,
      action: AuditAction.REPORT_REVIEWED,
      targetType: 'Report',
      targetId: reportId,
      details,
    });
  }

  async logSocialPromotionRetried(
    adminId: string,
    postId: string,
    details?: Record<string, unknown>,
  ) {
    return this.log({
      adminId,
      action: AuditAction.SOCIAL_PROMOTION_RETRIED,
      targetType: 'SocialPromotionPost',
      targetId: postId,
      details,
    });
  }

  async logSocialPromotionDisqualified(
    adminId: string,
    postId: string,
    reason: string,
    details?: Record<string, unknown>,
  ) {
    return this.log({
      adminId,
      action: AuditAction.SOCIAL_PROMOTION_DISQUALIFIED,
      targetType: 'SocialPromotionPost',
      targetId: postId,
      reason,
      details,
    });
  }
}

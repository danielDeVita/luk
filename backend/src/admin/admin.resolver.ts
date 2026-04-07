import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { MpEvent, MpEventList } from './entities/mp-event.entity';
import {
  AdminStats,
  AdminTransactionList,
  PaymentDebugInfo,
  AdminUserList,
  AdminReviewList,
  UserActivity,
  BulkResolveResult,
  KycSubmissionList,
  KycApprovalResult,
} from './entities/admin-stats.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { AdminSellerReview } from '../users/entities/review.entity';
import { AuditService } from '../audit/audit.service';
import { DisputesService } from '../disputes/disputes.service';
import { UserRole, AuditAction, TransactionType } from '@prisma/client';
import { UserRole as UserRoleEnum } from '../common/enums';

@Resolver()
export class AdminResolver {
  constructor(
    private adminService: AdminService,
    private auditService: AuditService,
    private disputesService: DisputesService,
  ) {}

  // ==================== MpEvent Viewer ====================

  @Query(() => MpEventList, {
    description: 'List MP webhook events for debugging',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async mpEvents(
    @Args('eventType', { nullable: true }) eventType?: string,
    @Args('limit', { nullable: true, type: () => Int }) limit?: number,
    @Args('offset', { nullable: true, type: () => Int }) offset?: number,
  ): Promise<MpEventList> {
    const result = await this.adminService.getMpEvents({
      eventType,
      limit,
      offset,
    });
    return {
      events: result.events.map((e) => ({
        ...e,
        metadata: e.metadata as Record<string, unknown> | undefined,
      })),
      total: result.total,
    };
  }

  @Query(() => MpEvent, { nullable: true, description: 'Get MP event by ID' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async mpEvent(@Args('eventId') eventId: string): Promise<MpEvent | null> {
    const event = await this.adminService.getMpEventById(eventId);
    if (!event) return null;
    return {
      ...event,
      metadata: event.metadata as Record<string, unknown> | undefined,
    };
  }

  // ==================== Payment Debug ====================

  @Query(() => PaymentDebugInfo, {
    description: 'Debug payment by MP payment ID',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async paymentDebug(
    @Args('mpPaymentId') mpPaymentId: string,
  ): Promise<PaymentDebugInfo> {
    const info = await this.adminService.getPaymentDebugInfo(mpPaymentId);
    return {
      ...info,
      transactionAmount: info.transactionAmount
        ? Number(info.transactionAmount)
        : undefined,
      tickets: info.tickets.map((t) => ({
        ...t,
        precioPagado: Number(t.precioPagado),
      })),
    };
  }

  @Query(() => AdminTransactionList, {
    description: 'List grant reversal transactions created after full refunds',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async promotionGrantReversalLogs(
    @Args('limit', { nullable: true, type: () => Int }) limit?: number,
    @Args('offset', { nullable: true, type: () => Int }) offset?: number,
  ): Promise<AdminTransactionList> {
    const result = await this.adminService.getTransactions({
      tipo: TransactionType.REVERSION_BONIFICACION_PROMOCIONAL,
      limit,
      offset,
    });

    return {
      transactions: result.transactions.map((transaction) => ({
        ...transaction,
        monto: Number(transaction.monto),
        mpPaymentId: transaction.mpPaymentId ?? undefined,
        grossAmount:
          transaction.grossAmount !== null &&
          transaction.grossAmount !== undefined
            ? Number(transaction.grossAmount)
            : undefined,
        promotionDiscountAmount:
          transaction.promotionDiscountAmount !== null &&
          transaction.promotionDiscountAmount !== undefined
            ? Number(transaction.promotionDiscountAmount)
            : undefined,
        cashChargedAmount:
          transaction.cashChargedAmount !== null &&
          transaction.cashChargedAmount !== undefined
            ? Number(transaction.cashChargedAmount)
            : undefined,
        metadata:
          (transaction.metadata as Record<string, unknown> | undefined) ??
          undefined,
        user: transaction.user ?? undefined,
        raffle: transaction.raffle ?? undefined,
      })),
      total: result.total,
    };
  }

  // ==================== Admin Stats ====================

  @Query(() => AdminStats, { description: 'Get admin dashboard statistics' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminStats(): Promise<AdminStats> {
    return this.adminService.getAdminStats();
  }

  // ==================== User Management ====================

  @Query(() => AdminUserList, { description: 'List all users with filtering' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminUsers(
    @Args('role', { nullable: true, type: () => UserRoleEnum }) role?: UserRole,
    @Args('search', { nullable: true }) search?: string,
    @Args('includeDeleted', { nullable: true }) includeDeleted?: boolean,
    @Args('limit', { nullable: true, type: () => Int }) limit?: number,
    @Args('offset', { nullable: true, type: () => Int }) offset?: number,
  ): Promise<AdminUserList> {
    return this.adminService.getUsers({
      role,
      search,
      includeDeleted,
      limit,
      offset,
    });
  }

  @Query(() => [UserActivity], {
    description: 'Get activity log for a specific user',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminUserActivity(
    @Args('userId') userId: string,
    @Args('limit', { nullable: true, type: () => Int }) limit?: number,
    @Args('offset', { nullable: true, type: () => Int }) offset?: number,
  ): Promise<UserActivity[]> {
    const activities = await this.adminService.getUserActivity(
      userId,
      limit,
      offset,
    );
    return activities.map((a) => ({
      id: a.id,
      action: a.action,
      targetType: a.targetType ?? undefined,
      targetId: a.targetId ?? undefined,
      metadata: a.metadata ? JSON.stringify(a.metadata) : undefined,
      ipAddress: a.ipAddress ?? undefined,
      createdAt: a.createdAt,
    }));
  }

  @Query(() => AdminReviewList, {
    description: 'List seller reviews for moderation',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminReviews(
    @Args('includeHidden', { nullable: true }) includeHidden?: boolean,
    @Args('limit', { nullable: true, type: () => Int }) limit?: number,
    @Args('offset', { nullable: true, type: () => Int }) offset?: number,
  ): Promise<AdminReviewList> {
    return this.adminService.getReviews({ includeHidden, limit, offset });
  }

  @Mutation(() => AdminSellerReview, {
    description: 'Hide a seller review comment while keeping its rating',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async hideReviewComment(
    @CurrentUser() admin: User,
    @Args('reviewId') reviewId: string,
    @Args('reason') reason: string,
  ): Promise<AdminSellerReview> {
    return this.adminService.hideReviewComment(reviewId, admin.id, reason);
  }

  @Mutation(() => User, { description: 'Ban a user' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async banUser(
    @CurrentUser() admin: User,
    @Args('userId') userId: string,
    @Args('reason') reason: string,
  ): Promise<User> {
    const user = await this.adminService.banUser(userId);
    await this.auditService.logUserBan(admin.id, userId, reason);
    return user;
  }

  @Mutation(() => User, { description: 'Unban a user' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async unbanUser(
    @CurrentUser() admin: User,
    @Args('userId') userId: string,
    @Args('reason') reason: string,
  ): Promise<User> {
    const user = await this.adminService.unbanUser(userId);
    await this.auditService.logUserUnban(admin.id, userId, reason);
    return user;
  }

  // ==================== KYC Management ====================

  @Query(() => KycSubmissionList, {
    description: 'List pending KYC submissions for review',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async pendingKycSubmissions(
    @Args('limit', { nullable: true, type: () => Int }) limit?: number,
    @Args('offset', { nullable: true, type: () => Int }) offset?: number,
  ): Promise<KycSubmissionList> {
    return this.adminService.getPendingKycSubmissions(limit, offset);
  }

  @Mutation(() => KycApprovalResult, {
    description: 'Approve a KYC submission',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async approveKyc(
    @CurrentUser() admin: User,
    @Args('userId') userId: string,
  ): Promise<KycApprovalResult> {
    const result = await this.adminService.approveKyc(userId);
    await this.auditService.log({
      adminId: admin.id,
      action: AuditAction.KYC_APPROVED,
      targetType: 'USER',
      targetId: userId,
      details: { approvedBy: admin.email },
    });
    return result;
  }

  @Mutation(() => KycApprovalResult, {
    description: 'Reject a KYC submission',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async rejectKyc(
    @CurrentUser() admin: User,
    @Args('userId') userId: string,
    @Args('reason') reason: string,
  ): Promise<KycApprovalResult> {
    const result = await this.adminService.rejectKyc(userId, reason);
    await this.auditService.log({
      adminId: admin.id,
      action: AuditAction.KYC_REJECTED,
      targetType: 'USER',
      targetId: userId,
      details: { rejectedBy: admin.email, reason },
    });
    return result;
  }

  // ==================== Bulk Dispute Resolution ====================

  @Mutation(() => BulkResolveResult, {
    description: 'Resolve multiple disputes at once',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async bulkResolveDisputes(
    @CurrentUser() admin: User,
    @Args('disputeIds', { type: () => [String] }) disputeIds: string[],
    @Args('decision') decision: string,
    @Args('resolucion') resolucion: string,
    @Args('adminNotes', { nullable: true }) adminNotes?: string,
  ): Promise<BulkResolveResult> {
    const successIds: string[] = [];
    const failedIds: string[] = [];
    const errors: string[] = [];

    for (const disputeId of disputeIds) {
      try {
        await this.disputesService.resolveDispute(admin.id, disputeId, {
          decision: decision as
            | 'RESUELTA_COMPRADOR'
            | 'RESUELTA_VENDEDOR'
            | 'RESUELTA_PARCIAL',
          resolucion,
          adminNotes,
        });
        successIds.push(disputeId);
      } catch (error) {
        failedIds.push(disputeId);
        errors.push(`${disputeId}: ${(error as Error).message}`);
      }
    }

    return {
      successCount: successIds.length,
      failedCount: failedIds.length,
      failedIds,
      errors,
    };
  }
}

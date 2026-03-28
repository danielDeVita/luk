import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, User } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

@Resolver()
export class ReportsResolver {
  constructor(
    private reportsService: ReportsService,
    private auditService: AuditService,
  ) {}

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async reportRaffle(
    @CurrentUser() user: User,
    @Args('raffleId') raffleId: string,
    @Args('reason') reason: string,
  ) {
    await this.reportsService.createReport(user.id, raffleId, reason);
    return true;
  }

  @Query(() => String)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getReports(
    @Args('reviewed', { nullable: true }) reviewed?: boolean,
    @Args('raffleId', { nullable: true }) raffleId?: string,
  ) {
    const reports = await this.reportsService.getReports({
      reviewed,
      raffleId,
    });
    return JSON.stringify(reports);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async reviewReport(
    @CurrentUser() admin: User,
    @Args('reportId') reportId: string,
    @Args('adminNotes') adminNotes: string,
    @Args('action') action: 'DISMISS' | 'HIDE_RAFFLE' | 'BAN_SELLER',
  ) {
    const result = await this.reportsService.reviewReport(
      reportId,
      adminNotes,
      action,
    );

    await this.auditService.logReportReviewed(admin.id, reportId, {
      reportAction: action,
      adminNotes,
      raffleId: result.raffleId,
      sellerId: result.sellerId,
    });

    if (action === 'HIDE_RAFFLE') {
      await this.auditService.logRaffleHidden(
        admin.id,
        result.raffleId,
        adminNotes,
      );
    }

    return true;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async unhideRaffle(
    @CurrentUser() admin: User,
    @Args('raffleId') raffleId: string,
    @Args('adminNotes') adminNotes: string,
  ) {
    await this.reportsService.unhideRaffle(raffleId, adminNotes);
    await this.auditService.logRaffleUnhidden(admin.id, raffleId, adminNotes);
    return true;
  }
}

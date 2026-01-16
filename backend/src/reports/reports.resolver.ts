import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Resolver()
export class ReportsResolver {
  constructor(private reportsService: ReportsService) {}

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async reportRaffle(
    @CurrentUser() user: any,
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
    @Args('reportId') reportId: string,
    @Args('adminNotes') adminNotes: string,
    @Args('action') action: 'DISMISS' | 'HIDE_RAFFLE' | 'BAN_SELLER',
  ) {
    await this.reportsService.reviewReport(reportId, adminNotes, action);
    return true;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async unhideRaffle(
    @Args('raffleId') raffleId: string,
    @Args('adminNotes') adminNotes: string,
  ) {
    await this.reportsService.unhideRaffle(raffleId, adminNotes);
    return true;
  }
}

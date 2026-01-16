import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import {
  ReferralCredit,
  ReferralCreditType,
  ReferralCreditStatus,
  ReferralStats,
  ReferredUser,
} from './entities/referral-credit.entity';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Resolver()
export class ReferralsResolver {
  constructor(private referralsService: ReferralsService) {}

  @Query(() => ReferralStats)
  @UseGuards(GqlAuthGuard)
  async myReferralStats(@CurrentUser() user: User): Promise<ReferralStats> {
    const stats = await this.referralsService.getReferralStats(user.id);
    return {
      ...stats,
      referralCode: stats.referralCode ?? undefined,
    };
  }

  @Query(() => String, { nullable: true })
  @UseGuards(GqlAuthGuard)
  async myReferralCode(@CurrentUser() user: User): Promise<string | null> {
    return this.referralsService.getReferralCode(user.id);
  }

  @Mutation(() => String)
  @UseGuards(GqlAuthGuard)
  async generateReferralCode(@CurrentUser() user: User): Promise<string> {
    return this.referralsService.generateReferralCode(user.id);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async applyReferralCode(
    @CurrentUser() user: User,
    @Args('code') code: string,
  ): Promise<boolean> {
    return this.referralsService.applyReferralCode(user.id, code);
  }

  @Query(() => [ReferralCredit])
  @UseGuards(GqlAuthGuard)
  async myReferralCredits(@CurrentUser() user: User): Promise<ReferralCredit[]> {
    const credits = await this.referralsService.getReferralCredits(user.id);
    return credits.map((c) => ({
      ...c,
      amount: Number(c.amount),
      type: c.type as unknown as ReferralCreditType,
      status: c.status as unknown as ReferralCreditStatus,
      description: c.description ?? undefined,
      ticketId: c.ticketId ?? undefined,
      processedAt: c.processedAt ?? undefined,
    }));
  }

  @Query(() => [ReferredUser])
  @UseGuards(GqlAuthGuard)
  async myReferredUsers(@CurrentUser() user: User): Promise<ReferredUser[]> {
    return this.referralsService.getReferredUsers(user.id);
  }
}

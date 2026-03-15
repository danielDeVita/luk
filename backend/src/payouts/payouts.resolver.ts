import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { Payout } from './entities/payout.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

/**
 * GraphQL entrypoints for seller payout visibility and admin payout operations.
 */
@Resolver(() => Payout)
export class PayoutsResolver {
  constructor(private payoutsService: PayoutsService) {}

  /**
   * Returns the authenticated seller's payout history.
   */
  @Query(() => [Payout])
  @UseGuards(JwtAuthGuard)
  async myPayouts(@CurrentUser() user: { id: string }) {
    return this.payoutsService.getSellerPayouts(user.id);
  }

  /**
   * Returns the payout for a raffle when the current user is allowed to see it.
   */
  @Query(() => Payout, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async rafflePayout(
    @CurrentUser() user: { id: string; role: UserRole },
    @Args('raffleId') raffleId: string,
  ) {
    return this.payoutsService.getPayoutByRaffleForUser(
      raffleId,
      user.id,
      user.role,
    );
  }

  /**
   * Returns pending payouts for admins.
   */
  @Query(() => [Payout])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async pendingPayouts() {
    return this.payoutsService.getPendingPayouts();
  }

  /**
   * Lets an admin release a payout manually with an audit reason.
   */
  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async releasePayoutManually(
    @CurrentUser() user: { id: string },
    @Args('payoutId') payoutId: string,
    @Args('reason') reason: string,
  ) {
    return this.payoutsService.releasePayoutManually(user.id, payoutId, reason);
  }

  /**
   * Triggers processing for all payouts that are currently due.
   */
  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async processDuePayouts() {
    await this.payoutsService.processDuePayouts();
    return true;
  }
}

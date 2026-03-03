import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { Payout } from './entities/payout.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Resolver(() => Payout)
export class PayoutsResolver {
  constructor(private payoutsService: PayoutsService) {}

  @Query(() => [Payout])
  @UseGuards(JwtAuthGuard)
  async myPayouts(@CurrentUser() user: { id: string }) {
    return this.payoutsService.getSellerPayouts(user.id);
  }

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

  @Query(() => [Payout])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async pendingPayouts() {
    return this.payoutsService.getPendingPayouts();
  }

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

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async processDuePayouts() {
    await this.payoutsService.processDuePayouts();
    return true;
  }
}

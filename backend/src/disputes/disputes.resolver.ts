import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { DisputesService } from './disputes.service';
import { Dispute } from './entities/dispute.entity';
import { OpenDisputeInput, RespondDisputeInput, ResolveDisputeInput } from './dto/dispute.input';
import { UserRole } from '@prisma/client';

@Resolver(() => Dispute)
@UseGuards(GqlAuthGuard)
export class DisputesResolver {
  constructor(private readonly disputesService: DisputesService) {}

  @Mutation(() => Dispute)
  openDispute(
    @CurrentUser() user: User,
    @Args('input') input: OpenDisputeInput,
  ) {
    return this.disputesService.openDispute(user.id, input);
  }

  @Mutation(() => Dispute)
  respondDispute(
    @CurrentUser() user: User,
    @Args('disputeId') disputeId: string,
    @Args('input') input: RespondDisputeInput,
  ) {
    return this.disputesService.respondDispute(user.id, disputeId, input);
  }

  @Mutation(() => Dispute)
  resolveDispute(
    @CurrentUser() user: User,
    @Args('disputeId') disputeId: string,
    @Args('input') input: ResolveDisputeInput,
  ) {
    // Basic check, in production use RolesGuard
    if (user.role !== UserRole.ADMIN) {
        throw new Error('Unauthorized');
    }
    return this.disputesService.resolveDispute(user.id, disputeId, input);
  }

  @Query(() => [Dispute])
  pendingDisputes(@CurrentUser() user: User) {
    if (user.role !== UserRole.ADMIN) throw new Error('Unauthorized');
    return this.disputesService.findAllPending();
  }

  @Query(() => [Dispute])
  myDisputes(@CurrentUser() user: User) {
    return this.disputesService.findByUser(user.id);
  }

  @Query(() => Dispute)
  dispute(@Args('id') id: string) {
    return this.disputesService.findOne(id);
  }
}

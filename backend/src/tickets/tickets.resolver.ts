import { Resolver, Mutation, Args, Query, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { Ticket } from './entities/ticket.entity';
import { BuyTicketsResult } from './entities/buy-tickets-result.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

/**
 * GraphQL entrypoints for buying tickets and reading ticket ownership data.
 */
@Resolver(() => Ticket)
export class TicketsResolver {
  constructor(private readonly ticketsService: TicketsService) {}

  /**
   * Reserves tickets for the current user and returns checkout information.
   */
  @Mutation(() => BuyTicketsResult)
  @UseGuards(JwtAuthGuard)
  async buyTickets(
    @CurrentUser() user: User,
    @Args('raffleId') raffleId: string,
    @Args('cantidad', { type: () => Int }) cantidad: number,
    @Args('bonusGrantId', { nullable: true }) bonusGrantId?: string,
    @Args('promotionToken', { nullable: true }) promotionToken?: string,
  ): Promise<BuyTicketsResult> {
    const result = await this.ticketsService.buyTickets(
      user.id,
      raffleId,
      cantidad,
      bonusGrantId,
      promotionToken,
    );
    // Cast Prisma Decimal types to numbers for GraphQL
    return result as unknown as BuyTicketsResult;
  }

  /**
   * Returns the authenticated user's ticket history.
   */
  @Query(() => [Ticket])
  @UseGuards(JwtAuthGuard)
  async myTickets(@CurrentUser() user: User): Promise<Ticket[]> {
    const tickets = await this.ticketsService.findByUser(user.id);
    return tickets as unknown as Ticket[];
  }

  /**
   * Returns a single ticket when the current user is allowed to see it.
   */
  @Query(() => Ticket)
  @UseGuards(JwtAuthGuard)
  async ticket(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<Ticket> {
    const ticket = await this.ticketsService.findOne(id, user.id, user.role);
    return ticket as unknown as Ticket;
  }
}

import { Resolver, Mutation, Args, Query, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { Ticket } from './entities/ticket.entity';
import { BuyTicketsResult } from './entities/buy-tickets-result.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Resolver(() => Ticket)
export class TicketsResolver {
  constructor(private readonly ticketsService: TicketsService) {}

  @Mutation(() => BuyTicketsResult)
  @UseGuards(JwtAuthGuard)
  async buyTickets(
    @CurrentUser() user: User,
    @Args('raffleId') raffleId: string,
    @Args('cantidad', { type: () => Int }) cantidad: number,
  ): Promise<BuyTicketsResult> {
    const result = await this.ticketsService.buyTickets(user.id, raffleId, cantidad);
    // Cast Prisma Decimal types to numbers for GraphQL
    return result as unknown as BuyTicketsResult;
  }

  @Query(() => [Ticket])
  @UseGuards(JwtAuthGuard)
  async myTickets(@CurrentUser() user: User): Promise<Ticket[]> {
    const tickets = await this.ticketsService.findByUser(user.id);
    return tickets as unknown as Ticket[];
  }

  @Query(() => Ticket)
  @UseGuards(JwtAuthGuard)
  async ticket(@Args('id') id: string): Promise<Ticket> {
    const ticket = await this.ticketsService.findOne(id);
    return ticket as unknown as Ticket;
  }
}

import { Resolver, Mutation, Args, Query, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { Ticket } from './entities/ticket.entity';
import { BuyTicketsResult } from './entities/buy-tickets-result.entity';
import { TicketNumberAvailabilityPage } from './entities/ticket-number-availability.entity';
import {
  TicketPurchaseReceiptEntity,
  TicketPurchaseReceiptSummaryEntity,
} from './entities/ticket-purchase-receipt.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { Public } from '../auth/decorators/public.decorator';
import { TicketReceiptAcceptanceSource } from '../common/enums';
import { TicketPurchaseReceiptsService } from './ticket-purchase-receipts.service';

/**
 * GraphQL entrypoints for buying tickets and reading ticket ownership data.
 */
@Resolver(() => Ticket)
export class TicketsResolver {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly ticketPurchaseReceiptsService: TicketPurchaseReceiptsService,
  ) {}

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
   * Reserves the exact requested ticket numbers for the current user and returns checkout information.
   */
  @Mutation(() => BuyTicketsResult)
  @UseGuards(JwtAuthGuard)
  async buySelectedTickets(
    @CurrentUser() user: User,
    @Args('raffleId') raffleId: string,
    @Args('selectedNumbers', { type: () => [Int] }) selectedNumbers: number[],
    @Args('bonusGrantId', { nullable: true }) bonusGrantId?: string,
    @Args('promotionToken', { nullable: true }) promotionToken?: string,
  ): Promise<BuyTicketsResult> {
    const result = await this.ticketsService.buySelectedTickets(
      user.id,
      raffleId,
      selectedNumbers,
      bonusGrantId,
      promotionToken,
    );
    return result as unknown as BuyTicketsResult;
  }

  /**
   * Returns paginated ticket-number availability for the raffle purchase picker.
   */
  @Query(() => TicketNumberAvailabilityPage)
  @Public()
  async ticketNumberAvailability(
    @Args('raffleId') raffleId: string,
    @Args('page', { type: () => Int }) page: number,
    @Args('pageSize', { type: () => Int }) pageSize: number,
    @Args('searchNumber', { type: () => Int, nullable: true })
    searchNumber?: number,
  ): Promise<TicketNumberAvailabilityPage> {
    return this.ticketsService.getTicketNumberAvailability(
      raffleId,
      page,
      pageSize,
      searchNumber,
    ) as unknown as TicketNumberAvailabilityPage;
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

  @Query(() => TicketPurchaseReceiptEntity)
  @UseGuards(JwtAuthGuard)
  async ticketPurchaseReceipt(
    @CurrentUser() user: User,
    @Args('purchaseReference') purchaseReference: string,
  ): Promise<TicketPurchaseReceiptEntity> {
    return this.ticketPurchaseReceiptsService.getReceipt(
      user.id,
      purchaseReference,
    ) as unknown as TicketPurchaseReceiptEntity;
  }

  @Query(() => [TicketPurchaseReceiptSummaryEntity])
  @UseGuards(JwtAuthGuard)
  async myTicketPurchaseReceipts(
    @CurrentUser() user: User,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
    @Args('pendingOnly', { nullable: true }) pendingOnly?: boolean,
  ): Promise<TicketPurchaseReceiptSummaryEntity[]> {
    return this.ticketPurchaseReceiptsService.listReceipts(
      user.id,
      take ?? 20,
      pendingOnly ?? false,
    ) as unknown as TicketPurchaseReceiptSummaryEntity[];
  }

  @Mutation(() => TicketPurchaseReceiptEntity)
  @UseGuards(JwtAuthGuard)
  async acknowledgeTicketPurchaseReceipt(
    @CurrentUser() user: User,
    @Args('purchaseReference') purchaseReference: string,
    @Args('source', { type: () => TicketReceiptAcceptanceSource })
    source: TicketReceiptAcceptanceSource,
  ): Promise<TicketPurchaseReceiptEntity> {
    return this.ticketPurchaseReceiptsService.acknowledgeReceipt(
      user.id,
      purchaseReference,
      source,
    ) as unknown as TicketPurchaseReceiptEntity;
  }

  /**
   * Returns how many non-refunded tickets the authenticated user already holds in the raffle.
   */
  @Query(() => Int)
  @UseGuards(JwtAuthGuard)
  async myTicketCountInRaffle(
    @CurrentUser() user: User,
    @Args('raffleId') raffleId: string,
  ): Promise<number> {
    return this.ticketsService.getUserTicketCount(user.id, raffleId);
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

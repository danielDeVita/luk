import { Resolver, Query, Mutation, Args, Int, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { RafflesService } from './raffles.service';
import { Raffle, PaginatedRaffles, SellerDashboardStats, BulkActionResult, BuyerStats } from './entities/raffle.entity';
import { PriceHistory } from './entities/price-history.entity';
import { CreateRaffleInput, UpdateRaffleInput } from './dto/create-raffle.input';
import { RaffleFiltersInput } from './dto/raffle-filters.input';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { PaginationInput } from '../common/dto/pagination.input';
import { UserRole } from '@prisma/client';

@Resolver(() => Raffle)
export class RafflesResolver {
  constructor(private rafflesService: RafflesService) {}

  @Public()
  @Query(() => [Raffle])
  async raffles(
    @Args('filters', { nullable: true }) filters?: RaffleFiltersInput,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ) {
    const result = await this.rafflesService.findAll(
      filters,
      pagination?.page,
      pagination?.limit,
    );
    return result.raffles;
  }

  @Public()
  @Query(() => PaginatedRaffles)
  async rafflesPaginated(
    @Args('filters', { nullable: true }) filters?: RaffleFiltersInput,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ): Promise<PaginatedRaffles> {
    const result = await this.rafflesService.findAll(
      filters,
      pagination?.page,
      pagination?.limit,
    );

    const totalPages = Math.ceil(result.total / result.limit);

    // Transform Decimal to number for ticket prices (Prisma returns Decimal, GraphQL expects number)
    const items = result.raffles.map((raffle: any) => ({
      ...raffle,
      tickets: raffle.tickets?.map((ticket: any) => ({
        ...ticket,
        precioPagado: Number(ticket.precioPagado),
      })),
    })) as Raffle[];

    return {
      items,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages,
        hasNext: result.page < totalPages,
        hasPrev: result.page > 1,
      },
    };
  }

  @Public()
  @Query(() => Raffle)
  async raffle(@Args('id') id: string) {
    return this.rafflesService.findOne(id);
  }

  @Query(() => [Raffle])
  @UseGuards(GqlAuthGuard)
  async myRafflesAsSeller(@CurrentUser() user: User) {
    return this.rafflesService.findByUser(user.id);
  }

  @Mutation(() => Raffle)
  @UseGuards(GqlAuthGuard)
  async createRaffle(
    @CurrentUser() user: User,
    @Args('input') input: CreateRaffleInput,
  ) {
    return this.rafflesService.create(user.id, input);
  }

  @Mutation(() => Raffle)
  @UseGuards(GqlAuthGuard)
  async updateRaffle(
    @CurrentUser() user: User,
    @Args('id') id: string,
    @Args('input') input: UpdateRaffleInput,
  ) {
    return this.rafflesService.update(id, user.id, input);
  }

  @Mutation(() => Raffle)
  @UseGuards(GqlAuthGuard)
  async cancelRaffle(@CurrentUser() user: User, @Args('id') id: string) {
    return this.rafflesService.cancel(id, user.id);
  }

  @Mutation(() => Raffle)
  @UseGuards(GqlAuthGuard)
  async markAsShipped(
    @CurrentUser() user: User,
    @Args('raffleId') raffleId: string,
    @Args('trackingNumber', { nullable: true }) trackingNumber?: string,
  ) {
    return this.rafflesService.markAsShipped(raffleId, user.id, trackingNumber);
  }

  @Mutation(() => Raffle)
  @UseGuards(GqlAuthGuard)
  async confirmDelivery(
    @CurrentUser() user: User,
    @Args('raffleId') raffleId: string,
  ) {
    return this.rafflesService.confirmDelivery(raffleId, user.id);
  }

  @Mutation(() => Raffle)
  @UseGuards(GqlAuthGuard)
  async extendRaffleDeadline(
    @CurrentUser() user: User,
    @Args('raffleId') raffleId: string,
    @Args('newDeadline') newDeadline: string,
  ) {
    return this.rafflesService.extendRaffleDeadline(raffleId, user.id, new Date(newDeadline));
  }

  @Mutation(() => Raffle)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async rejectRaffleWinner(
    @CurrentUser() user: User,
    @Args('raffleId') raffleId: string,
    @Args('reason') reason: string,
  ) {
    return this.rafflesService.rejectRaffleWinner(raffleId, user.id, reason);
  }

  @ResolveField(() => Int)
  ticketsVendidos(@Parent() raffle: any) {
    return this.rafflesService.getTicketStats(raffle).ticketsVendidos;
  }

  @ResolveField(() => Int)
  ticketsDisponibles(@Parent() raffle: any) {
    return this.rafflesService.getTicketStats(raffle).ticketsDisponibles;
  }

  @ResolveField(() => Int)
  maxTicketsPorUsuario(@Parent() raffle: any) {
    return this.rafflesService.getTicketStats(raffle).maxTicketsPorUsuario;
  }

  // ==================== SELLER DASHBOARD ====================

  @Query(() => SellerDashboardStats)
  @UseGuards(GqlAuthGuard)
  async sellerDashboardStats(@CurrentUser() user: User): Promise<SellerDashboardStats> {
    return this.rafflesService.getSellerDashboardStats(user.id);
  }

  @Mutation(() => BulkActionResult)
  @UseGuards(GqlAuthGuard)
  async bulkCancelRaffles(
    @CurrentUser() user: User,
    @Args('raffleIds', { type: () => [String] }) raffleIds: string[],
  ): Promise<BulkActionResult> {
    return this.rafflesService.bulkCancelRaffles(user.id, raffleIds);
  }

  @Mutation(() => BulkActionResult)
  @UseGuards(GqlAuthGuard)
  async bulkExtendRaffles(
    @CurrentUser() user: User,
    @Args('raffleIds', { type: () => [String] }) raffleIds: string[],
    @Args('newDeadline') newDeadline: string,
  ): Promise<BulkActionResult> {
    return this.rafflesService.bulkExtendRaffles(user.id, raffleIds, new Date(newDeadline));
  }

  @Mutation(() => Boolean)
  @Public()
  async incrementRaffleViews(@Args('raffleId') raffleId: string): Promise<boolean> {
    await this.rafflesService.incrementViewCount(raffleId);
    return true;
  }

  // ==================== BUYER EXPERIENCE ====================

  @Query(() => BuyerStats)
  @UseGuards(GqlAuthGuard)
  async buyerStats(@CurrentUser() user: User): Promise<BuyerStats> {
    return this.rafflesService.getBuyerStats(user.id);
  }

  @Query(() => [Raffle])
  @UseGuards(GqlAuthGuard)
  async recommendedRaffles(
    @CurrentUser() user: User,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 6 }) limit: number,
  ): Promise<Raffle[]> {
    return this.rafflesService.getRecommendedRaffles(user.id, limit) as unknown as Raffle[];
  }

  @Query(() => [Raffle])
  @UseGuards(GqlAuthGuard)
  async favoritesEndingSoon(
    @CurrentUser() user: User,
    @Args('hoursThreshold', { type: () => Int, nullable: true, defaultValue: 48 }) hoursThreshold: number,
  ): Promise<Raffle[]> {
    return this.rafflesService.getFavoritesEndingSoon(user.id, hoursThreshold) as unknown as Raffle[];
  }

  // ==================== PRICE ALERTS ====================

  @Public()
  @Query(() => [PriceHistory])
  async priceHistory(@Args('raffleId') raffleId: string): Promise<PriceHistory[]> {
    return this.rafflesService.getPriceHistory(raffleId) as unknown as PriceHistory[];
  }

  @Mutation(() => Raffle)
  @UseGuards(GqlAuthGuard)
  async updateRafflePrice(
    @CurrentUser() user: User,
    @Args('raffleId') raffleId: string,
    @Args('newPrice', { type: () => Number }) newPrice: number,
  ): Promise<Raffle> {
    return this.rafflesService.updatePrice(raffleId, user.id, newPrice) as unknown as Raffle;
  }
}

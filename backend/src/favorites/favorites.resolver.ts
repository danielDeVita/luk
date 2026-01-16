import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { Favorite } from './entities/favorite.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Resolver(() => Favorite)
export class FavoritesResolver {
  constructor(private favoritesService: FavoritesService) {}

  @Query(() => [Favorite])
  @UseGuards(JwtAuthGuard)
  async myFavorites(@CurrentUser() user: { id: string }) {
    return this.favoritesService.getUserFavorites(user.id);
  }

  @Query(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async isFavorite(
    @CurrentUser() user: { id: string },
    @Args('raffleId') raffleId: string,
  ) {
    return this.favoritesService.isFavorite(user.id, raffleId);
  }

  @Mutation(() => Favorite)
  @UseGuards(JwtAuthGuard)
  async addFavorite(
    @CurrentUser() user: { id: string },
    @Args('raffleId') raffleId: string,
  ) {
    return this.favoritesService.addFavorite(user.id, raffleId);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async removeFavorite(
    @CurrentUser() user: { id: string },
    @Args('raffleId') raffleId: string,
  ) {
    return this.favoritesService.removeFavorite(user.id, raffleId);
  }
}

import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  UpdateProfileInput,
  ChangePasswordInput,
  UpdateKycInput,
  AcceptTermsInput,
  UpdateAvatarInput,
  CreateSellerReviewInput,
} from './dto/update-user.input';
import { PublicSellerProfile } from './entities/public-seller-profile.entity';
import { PublicSellerReview } from './entities/review.entity';
import { Public } from '../auth/decorators/public.decorator';

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Query(() => PublicSellerProfile)
  async sellerProfile(@Args('id') id: string) {
    return this.usersService.getSellerProfile(id);
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async updateProfile(
    @CurrentUser() user: User,
    @Args('input') input: UpdateProfileInput,
  ) {
    return this.usersService.updateProfile(user.id, input);
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async changePassword(
    @CurrentUser() user: User,
    @Args('input') input: ChangePasswordInput,
  ) {
    return this.usersService.changePassword(
      user.id,
      input.oldPassword,
      input.newPassword,
    );
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async updateKyc(
    @CurrentUser() user: User,
    @Args('input') input: UpdateKycInput,
  ) {
    return this.usersService.updateKyc(user.id, input);
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async acceptTerms(
    @CurrentUser() user: User,
    @Args('input') input: AcceptTermsInput,
  ) {
    return this.usersService.acceptTerms(user.id, input);
  }

  @Mutation(() => PublicSellerReview)
  @UseGuards(GqlAuthGuard)
  async createSellerReview(
    @CurrentUser() user: User,
    @Args('input') input: CreateSellerReviewInput,
  ) {
    return this.usersService.createSellerReview(user.id, input);
  }

  // ==================== AVATAR MANAGEMENT ====================

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async updateAvatar(
    @CurrentUser() user: User,
    @Args('input') input: UpdateAvatarInput,
  ) {
    return this.usersService.updateAvatar(user.id, input.avatarUrl);
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async deleteAvatar(@CurrentUser() user: User) {
    return this.usersService.deleteAvatar(user.id);
  }
}

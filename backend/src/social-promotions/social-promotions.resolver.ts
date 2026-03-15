import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import {
  PromotionBonusGrantStatus as PrismaPromotionBonusGrantStatus,
  UserRole,
} from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';
import { User } from '../users/entities/user.entity';
import {
  PromotionBonusGrant,
  PromotionBonusGrantStatus,
  PromotionBonusPreview,
  SocialPromotionDraft,
  SocialPromotionNetwork,
  SocialPromotionPost,
} from './entities/social-promotion.entity';
import { SocialPromotionsService } from './social-promotions.service';

/**
 * GraphQL entrypoints for sellers and admins working with social promotions.
 */
@Resolver()
export class SocialPromotionsResolver {
  constructor(
    private readonly socialPromotionsService: SocialPromotionsService,
  ) {}

  /**
   * Starts a verifiable promotion draft for the current seller.
   */
  @Mutation(() => SocialPromotionDraft)
  @UseGuards(GqlAuthGuard)
  async startSocialPromotionDraft(
    @CurrentUser() user: User,
    @Args('raffleId') raffleId: string,
    @Args('network', { type: () => SocialPromotionNetwork })
    network: SocialPromotionNetwork,
  ): Promise<SocialPromotionDraft> {
    return this.socialPromotionsService.startSocialPromotionDraft(
      user.id,
      raffleId,
      network,
    );
  }

  /**
   * Submits a public social post for validation against an existing draft.
   */
  @Mutation(() => SocialPromotionPost)
  @UseGuards(GqlAuthGuard)
  async submitSocialPromotionPost(
    @CurrentUser() user: User,
    @Args('draftId') draftId: string,
    @Args('permalink') permalink: string,
  ): Promise<SocialPromotionPost> {
    return this.socialPromotionsService.submitSocialPromotionPost(
      user.id,
      draftId,
      permalink,
    );
  }

  /**
   * Returns the current seller's promotion posts.
   */
  @Query(() => [SocialPromotionPost])
  @UseGuards(GqlAuthGuard)
  async mySocialPromotionPosts(
    @CurrentUser() user: User,
    @Args('raffleId', { nullable: true }) raffleId?: string,
  ): Promise<SocialPromotionPost[]> {
    return this.socialPromotionsService.mySocialPromotionPosts(
      user.id,
      raffleId,
    );
  }

  /**
   * Returns the current seller's earned promotion bonus grants.
   */
  @Query(() => [PromotionBonusGrant])
  @UseGuards(GqlAuthGuard)
  async myPromotionBonusGrants(
    @CurrentUser() user: User,
    @Args('status', {
      nullable: true,
      type: () => PromotionBonusGrantStatus,
    })
    status?: PromotionBonusGrantStatus,
  ): Promise<PromotionBonusGrant[]> {
    return this.socialPromotionsService.myPromotionBonusGrants(
      user.id,
      status as unknown as PrismaPromotionBonusGrantStatus | undefined,
    );
  }

  /**
   * Previews how a selected promotion bonus would affect the current purchase.
   */
  @Query(() => PromotionBonusPreview)
  @UseGuards(GqlAuthGuard)
  async previewPromotionBonus(
    @CurrentUser() user: User,
    @Args('raffleId') raffleId: string,
    @Args('cantidad') cantidad: number,
    @Args('bonusGrantId') bonusGrantId: string,
  ): Promise<PromotionBonusPreview> {
    return this.socialPromotionsService.previewPromotionBonus(
      user.id,
      raffleId,
      cantidad,
      bonusGrantId,
    );
  }

  /**
   * Returns the admin queue for posts blocked in technical review.
   */
  @Query(() => [SocialPromotionPost])
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async socialPromotionReviewQueue(): Promise<SocialPromotionPost[]> {
    return this.socialPromotionsService.getTechnicalReviewQueue();
  }

  /**
   * Sends a technical-review post back through validation.
   */
  @Mutation(() => SocialPromotionPost)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminRetrySocialPromotionPost(
    @Args('postId') postId: string,
  ): Promise<SocialPromotionPost> {
    return this.socialPromotionsService.retryTechnicalReview(postId);
  }

  /**
   * Allows an admin to disqualify a promotion post explicitly.
   */
  @Mutation(() => SocialPromotionPost)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminDisqualifySocialPromotionPost(
    @Args('postId') postId: string,
    @Args('reason') reason: string,
  ): Promise<SocialPromotionPost> {
    return this.socialPromotionsService.adminDisqualifyPost(postId, reason);
  }
}

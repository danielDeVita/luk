import {
  Field,
  Float,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';

export enum SocialPromotionNetwork {
  FACEBOOK = 'FACEBOOK',
  INSTAGRAM = 'INSTAGRAM',
  X = 'X',
}

export enum SocialPromotionStatus {
  PENDING_VALIDATION = 'PENDING_VALIDATION',
  ACTIVE = 'ACTIVE',
  TECHNICAL_REVIEW = 'TECHNICAL_REVIEW',
  DISQUALIFIED = 'DISQUALIFIED',
  SETTLED = 'SETTLED',
}

export enum PromotionBonusGrantStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  USED = 'USED',
  EXPIRED = 'EXPIRED',
  REVERSED = 'REVERSED',
}

export enum PromotionBonusRedemptionStatus {
  RESERVED = 'RESERVED',
  USED = 'USED',
  RELEASED = 'RELEASED',
  REVERSED = 'REVERSED',
  EXPIRED = 'EXPIRED',
}

registerEnumType(SocialPromotionNetwork, { name: 'SocialPromotionNetwork' });
registerEnumType(SocialPromotionStatus, { name: 'SocialPromotionStatus' });
registerEnumType(PromotionBonusGrantStatus, {
  name: 'PromotionBonusGrantStatus',
});
registerEnumType(PromotionBonusRedemptionStatus, {
  name: 'PromotionBonusRedemptionStatus',
});

@ObjectType()
export class SocialPromotionDraft {
  @Field(() => ID)
  id!: string;

  @Field()
  raffleId!: string;

  @Field()
  sellerId!: string;

  @Field(() => SocialPromotionNetwork)
  network!: SocialPromotionNetwork;

  @Field()
  trackingUrl!: string;

  @Field()
  promotionToken!: string;

  @Field({ nullable: true })
  suggestedCopy?: string;

  @Field()
  expiresAt!: Date;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class SocialPromotionMetricSnapshot {
  @Field(() => ID)
  id!: string;

  @Field()
  socialPromotionPostId!: string;

  @Field()
  checkedAt!: Date;

  @Field()
  isAccessible!: boolean;

  @Field()
  tokenPresent!: boolean;

  @Field(() => Int, { nullable: true })
  likesCount?: number;

  @Field(() => Int, { nullable: true })
  commentsCount?: number;

  @Field(() => Int, { nullable: true })
  repostsOrSharesCount?: number;

  @Field(() => Int, { nullable: true })
  viewsCount?: number;

  @Field(() => Int)
  clicksAttributed!: number;

  @Field(() => Int)
  registrationsAttributed!: number;

  @Field(() => Int)
  ticketPurchasesAttributed!: number;

  @Field({ nullable: true })
  parserVersion?: string;

  @Field({ nullable: true })
  failureReason?: string;
}

@ObjectType()
export class PromotionScoreSettlement {
  @Field(() => ID)
  id!: string;

  @Field()
  socialPromotionPostId!: string;

  @Field()
  sellerId!: string;

  @Field()
  raffleId!: string;

  @Field(() => Float)
  baseScore!: number;

  @Field(() => Float)
  engagementScore!: number;

  @Field(() => Float)
  conversionScore!: number;

  @Field(() => Float)
  totalScore!: number;

  @Field(() => SocialPromotionStatus)
  settlementStatus!: SocialPromotionStatus;

  @Field()
  settledAt!: Date;
}

@ObjectType()
export class PromotionBonusGrant {
  @Field(() => ID)
  id!: string;

  @Field()
  sellerId!: string;

  @Field()
  sourceSettlementId!: string;

  @Field(() => Float)
  discountPercent!: number;

  @Field(() => Float)
  maxDiscountAmount!: number;

  @Field()
  expiresAt!: Date;

  @Field(() => PromotionBonusGrantStatus)
  status!: PromotionBonusGrantStatus;

  @Field()
  createdAt!: Date;

  @Field(() => Date, { nullable: true })
  usedAt?: Date;
}

@ObjectType()
export class PromotionBonusPreview {
  @Field(() => Float)
  grossSubtotal!: number;

  @Field(() => Float)
  discountApplied!: number;

  @Field(() => Float)
  chargedAmount!: number;

  @Field()
  bonusGrantId!: string;
}

@ObjectType()
export class SocialPromotionPost {
  @Field(() => ID)
  id!: string;

  @Field()
  draftId!: string;

  @Field()
  raffleId!: string;

  @Field()
  sellerId!: string;

  @Field(() => SocialPromotionNetwork)
  network!: SocialPromotionNetwork;

  @Field()
  submittedPermalink!: string;

  @Field({ nullable: true })
  canonicalPermalink?: string;

  @Field({ nullable: true })
  canonicalPostId?: string;

  @Field(() => SocialPromotionStatus)
  status!: SocialPromotionStatus;

  @Field(() => Date, { nullable: true })
  publishedAt?: Date;

  @Field()
  submittedAt!: Date;

  @Field(() => Date, { nullable: true })
  validatedAt?: Date;

  @Field(() => Date, { nullable: true })
  lastCheckedAt?: Date;

  @Field(() => Date, { nullable: true })
  nextCheckAt?: Date;

  @Field(() => Date, { nullable: true })
  disqualifiedAt?: Date;

  @Field({ nullable: true })
  disqualificationReason?: string;

  @Field(() => [SocialPromotionMetricSnapshot], { nullable: true })
  snapshots?: SocialPromotionMetricSnapshot[];

  @Field(() => PromotionScoreSettlement, { nullable: true })
  settlement?: PromotionScoreSettlement;
}

@ObjectType()
export class SocialPromotionAnalyticsRow {
  @Field(() => ID)
  postId!: string;

  @Field()
  raffleId!: string;

  @Field()
  raffleTitle!: string;

  @Field()
  sellerId!: string;

  @Field()
  sellerEmail!: string;

  @Field(() => SocialPromotionNetwork)
  network!: SocialPromotionNetwork;

  @Field(() => SocialPromotionStatus)
  status!: SocialPromotionStatus;

  @Field()
  submittedPermalink!: string;

  @Field({ nullable: true })
  canonicalPermalink?: string;

  @Field()
  submittedAt!: Date;

  @Field(() => Date, { nullable: true })
  validatedAt?: Date;

  @Field(() => Date, { nullable: true })
  settledAt?: Date;

  @Field(() => Int, { nullable: true })
  likesCount?: number;

  @Field(() => Int, { nullable: true })
  commentsCount?: number;

  @Field(() => Int, { nullable: true })
  repostsOrSharesCount?: number;

  @Field(() => Int, { nullable: true })
  viewsCount?: number;

  @Field(() => Int, { nullable: true })
  clicksAttributed?: number;

  @Field(() => Int, { nullable: true })
  registrationsAttributed?: number;

  @Field(() => Int, { nullable: true })
  ticketPurchasesAttributed?: number;

  @Field(() => Float, { nullable: true })
  engagementScore?: number;

  @Field(() => Float, { nullable: true })
  conversionScore?: number;

  @Field(() => Float, { nullable: true })
  totalScore?: number;

  @Field()
  grantIssued!: boolean;

  @Field(() => PromotionBonusGrantStatus, { nullable: true })
  grantStatus?: PromotionBonusGrantStatus;

  @Field(() => Float, { nullable: true })
  grantDiscountPercent?: number;

  @Field(() => Float, { nullable: true })
  grantMaxDiscountAmount?: number;
}

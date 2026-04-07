import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class RaffleReviewStatus {
  @Field(() => ID)
  id!: string;
}

@ObjectType()
export class PublicSellerReview {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  rating!: number;

  @Field(() => String, { nullable: true })
  comentario?: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  reviewerName!: string;

  @Field()
  raffleTitle!: string;
}

@ObjectType()
export class AdminSellerReview extends PublicSellerReview {
  @Field()
  sellerName!: string;

  @Field()
  sellerEmail!: string;

  @Field()
  reviewerEmail!: string;

  @Field()
  commentHidden!: boolean;

  @Field(() => String, { nullable: true })
  commentHiddenReason?: string | null;
}

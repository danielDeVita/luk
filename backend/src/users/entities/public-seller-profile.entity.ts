import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Raffle } from '../../raffles/entities/raffle.entity';
import { PublicSellerReview } from './review.entity';

@ObjectType()
export class PublicSellerProfile {
  @Field()
  id!: string;

  @Field()
  nombre!: string;

  @Field()
  apellido!: string;

  @Field()
  createdAt!: Date;

  @Field(() => [Raffle], { nullable: 'items' })
  raffles!: Raffle[];

  @Field({ nullable: true })
  reputation?: number;

  @Field(() => Int, { defaultValue: 0 })
  totalVentas!: number;

  @Field(() => String, { defaultValue: 'NUEVO' })
  nivelVendedor!: string;

  @Field(() => Boolean, { defaultValue: false })
  isVerified!: boolean;

  @Field(() => Int, { defaultValue: 0 })
  reviewCount!: number;

  @Field(() => [PublicSellerReview])
  reviews!: PublicSellerReview[];
}

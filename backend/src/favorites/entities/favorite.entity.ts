import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Raffle } from '../../raffles/entities/raffle.entity';

@ObjectType()
export class Favorite {
  @Field(() => ID)
  id!: string;

  @Field()
  userId!: string;

  @Field()
  raffleId!: string;

  @Field()
  createdAt!: Date;

  @Field(() => Raffle, { nullable: true })
  raffle?: Raffle;
}

import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../../users/entities/user.entity';

@ObjectType()
export class RaffleAnswer {
  @Field(() => ID)
  id!: string;

  @Field()
  questionId!: string;

  @Field()
  sellerId!: string;

  @Field()
  content!: string;

  @Field()
  createdAt!: Date;

  @Field(() => User, { nullable: true })
  seller?: User;
}

@ObjectType()
export class RaffleQuestion {
  @Field(() => ID)
  id!: string;

  @Field()
  raffleId!: string;

  @Field()
  askerId!: string;

  @Field()
  content!: string;

  @Field()
  createdAt!: Date;

  @Field(() => User, { nullable: true })
  asker?: User;

  @Field(() => RaffleAnswer, { nullable: true })
  answer?: RaffleAnswer;
}


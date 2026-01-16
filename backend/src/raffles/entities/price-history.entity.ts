import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class PriceHistory {
  @Field(() => ID)
  id!: string;

  @Field()
  raffleId!: string;

  @Field()
  previousPrice!: number;

  @Field()
  newPrice!: number;

  @Field()
  changedAt!: Date;
}

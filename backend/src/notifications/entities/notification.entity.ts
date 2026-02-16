import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Notification {
  @Field(() => ID)
  id!: string;

  @Field()
  type!: string; // WIN, INFO, SYSTEM

  @Field()
  title!: string;

  @Field()
  message!: string;

  @Field()
  read!: boolean;

  @Field(() => String, { nullable: true })
  actionUrl?: string | null;

  @Field()
  createdAt!: Date;
}

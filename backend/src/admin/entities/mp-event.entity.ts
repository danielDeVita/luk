import { ObjectType, Field, ID } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
export class MpEvent {
  @Field(() => ID)
  id!: string;

  @Field()
  eventId!: string;

  @Field()
  eventType!: string;

  @Field()
  processedAt!: Date;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, unknown>;
}

@ObjectType()
export class MpEventList {
  @Field(() => [MpEvent])
  events!: MpEvent[];

  @Field()
  total!: number;
}

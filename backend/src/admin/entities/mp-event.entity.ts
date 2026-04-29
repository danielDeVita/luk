import { ObjectType, Field, ID } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
export class PaymentProviderEvent {
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
export class PaymentProviderEventList {
  @Field(() => [PaymentProviderEvent])
  events!: PaymentProviderEvent[];

  @Field()
  total!: number;
}

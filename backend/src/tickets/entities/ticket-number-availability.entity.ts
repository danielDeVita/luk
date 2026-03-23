import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class TicketNumberAvailabilityItem {
  @Field(() => Int)
  number!: number;

  @Field()
  isAvailable!: boolean;
}

@ObjectType()
export class TicketNumberAvailabilityPage {
  @Field(() => [TicketNumberAvailabilityItem])
  items!: TicketNumberAvailabilityItem[];

  @Field(() => Int)
  totalTickets!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;

  @Field(() => Int)
  availableCount!: number;

  @Field(() => Int)
  maxSelectable!: number;

  @Field(() => Int)
  premiumPercent!: number;
}

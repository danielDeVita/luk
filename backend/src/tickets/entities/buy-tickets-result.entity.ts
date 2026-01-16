import { ObjectType, Field, Float, Int } from '@nestjs/graphql';
import { Ticket } from './ticket.entity';

@ObjectType()
export class BuyTicketsResult {
  @Field(() => [Ticket])
  tickets!: Ticket[];

  @Field()
  initPoint!: string;

  @Field()
  preferenceId!: string;

  @Field(() => Float)
  totalAmount!: number;

  @Field(() => Int)
  cantidadComprada!: number;

  @Field(() => Int)
  ticketsRestantesQuePuedeComprar!: number;
}

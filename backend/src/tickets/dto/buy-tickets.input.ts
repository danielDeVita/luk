import { Field, InputType, Int, ObjectType, Float } from '@nestjs/graphql';
import { IsPositive, Min } from 'class-validator';
import { Ticket } from '../entities/ticket.entity';

@InputType()
export class BuyTicketsInput {
  @Field()
  raffleId!: string;

  @Field(() => Int)
  @IsPositive()
  @Min(1)
  cantidad!: number;
}

@ObjectType()
export class BuyTicketsPayload {
  @Field(() => [Ticket])
  tickets!: Ticket[];

  @Field()
  clientSecret!: string;

  @Field(() => Float)
  totalAmount!: number;

  @Field(() => Float)
  stripeFees!: number;

  @Field(() => Int)
  cantidadComprada!: number;

  @Field(() => Int)
  ticketsRestantesQuePuedeComprar!: number;
}

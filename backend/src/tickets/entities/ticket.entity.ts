import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';
import { TicketStatus } from '../../common/enums';
import { User } from '../../users/entities/user.entity';
import { Raffle } from '../../raffles/entities/raffle.entity';

@ObjectType()
export class Ticket {
  @Field(() => ID)
  id!: string;

  @Field()
  raffleId!: string;

  @Field(() => Raffle, { nullable: true })
  raffle?: Raffle;

  @Field(() => Int)
  numeroTicket!: number;

  @Field()
  buyerId!: string;

  @Field(() => User, { nullable: true })
  buyer?: User;

  @Field(() => Float)
  precioPagado!: number;

  @Field(() => String, { nullable: true })
  mpPaymentId?: string;

  @Field(() => TicketStatus)
  estado!: TicketStatus;

  @Field()
  fechaCompra!: Date;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

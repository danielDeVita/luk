import { ObjectType, Field, Float, Int } from '@nestjs/graphql';
import { Ticket } from './ticket.entity';
import { TicketPurchaseMode } from '../../common/enums';

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

  @Field(() => Float)
  grossSubtotal!: number;

  @Field(() => Float)
  discountApplied!: number;

  @Field(() => Float)
  mpChargeAmount!: number;

  @Field({ nullable: true })
  bonusGrantId?: string;

  @Field(() => Int)
  cantidadComprada!: number;

  @Field(() => Int)
  ticketsRestantesQuePuedeComprar!: number;

  @Field(() => TicketPurchaseMode)
  purchaseMode!: TicketPurchaseMode;

  @Field(() => Float)
  selectionPremiumPercent!: number;

  @Field(() => Float)
  selectionPremiumAmount!: number;
}

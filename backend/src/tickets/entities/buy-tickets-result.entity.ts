import { ObjectType, Field, Float, Int } from '@nestjs/graphql';
import { Ticket } from './ticket.entity';
import {
  PackIneligibilityReason,
  TicketPurchaseMode,
} from '../../common/enums';

@ObjectType()
export class BuyTicketsResult {
  @Field(() => [Ticket])
  tickets!: Ticket[];

  @Field()
  paidWithCredit!: boolean;

  @Field(() => Float)
  creditDebited!: number;

  @Field(() => Float)
  creditBalanceAfter!: number;

  @Field(() => Float)
  totalAmount!: number;

  @Field(() => Float)
  grossSubtotal!: number;

  @Field(() => Float)
  discountApplied!: number;

  @Field(() => Float)
  chargedAmount!: number;

  @Field({ nullable: true })
  bonusGrantId?: string;

  @Field(() => Int)
  cantidadComprada!: number;

  @Field(() => Int)
  baseQuantity!: number;

  @Field(() => Int)
  bonusQuantity!: number;

  @Field(() => Int)
  grantedQuantity!: number;

  @Field()
  packApplied!: boolean;

  @Field(() => PackIneligibilityReason, { nullable: true })
  packIneligibilityReason?: PackIneligibilityReason;

  @Field(() => Int)
  ticketsRestantesQuePuedeComprar!: number;

  @Field(() => TicketPurchaseMode)
  purchaseMode!: TicketPurchaseMode;

  @Field(() => Float)
  selectionPremiumPercent!: number;

  @Field(() => Float)
  selectionPremiumAmount!: number;
}

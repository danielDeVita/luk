import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  TicketPurchaseMode,
  TicketReceiptAcceptanceSource,
} from '../../common/enums';

@ObjectType()
export class TicketPurchaseReceiptSummaryEntity {
  @Field(() => ID)
  id!: string;

  @Field()
  purchaseReference!: string;

  @Field()
  raffleId!: string;

  @Field()
  raffleTitleSnapshot!: string;

  @Field(() => [Int])
  ticketNumbers!: number[];

  @Field(() => String)
  currencyCode!: string;

  @Field(() => Float)
  chargedAmount!: number;

  @Field(() => Int)
  baseQuantity!: number;

  @Field(() => Int)
  bonusQuantity!: number;

  @Field(() => Int)
  grantedQuantity!: number;

  @Field(() => Date, { nullable: true })
  buyerAcceptedAt?: Date | null;

  @Field(() => Boolean)
  acceptancePending!: boolean;

  @Field()
  createdAt!: Date;
}

@ObjectType()
export class TicketPurchaseReceiptEntity {
  @Field(() => ID)
  id!: string;

  @Field()
  purchaseReference!: string;

  @Field()
  raffleId!: string;

  @Field()
  raffleTitleSnapshot!: string;

  @Field(() => Int)
  receiptVersion!: number;

  @Field(() => String)
  currencyCode!: string;

  @Field(() => [Int])
  ticketNumbers!: number[];

  @Field(() => Float)
  grossSubtotal!: number;

  @Field(() => Float)
  packDiscountAmount!: number;

  @Field(() => Float)
  promotionDiscountAmount!: number;

  @Field(() => Float)
  selectionPremiumPercent!: number;

  @Field(() => Float)
  selectionPremiumAmount!: number;

  @Field(() => Float)
  chargedAmount!: number;

  @Field(() => Int)
  baseQuantity!: number;

  @Field(() => Int)
  bonusQuantity!: number;

  @Field(() => Int)
  grantedQuantity!: number;

  @Field(() => Boolean)
  packApplied!: boolean;

  @Field(() => TicketPurchaseMode)
  purchaseMode!: TicketPurchaseMode;

  @Field(() => Date, { nullable: true })
  buyerAcceptedAt?: Date | null;

  @Field(() => TicketReceiptAcceptanceSource, { nullable: true })
  acceptanceSource?: TicketReceiptAcceptanceSource | null;

  @Field(() => Boolean)
  acceptancePending!: boolean;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

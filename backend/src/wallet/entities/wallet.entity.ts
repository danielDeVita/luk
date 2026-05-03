import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { WalletLedgerEntryType } from '../../common/enums';

@ObjectType()
export class WalletAccountEntity {
  @Field(() => ID)
  id!: string;

  @Field()
  userId!: string;

  @Field(() => Float)
  creditBalance!: number;

  @Field(() => Float)
  sellerPayableBalance!: number;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class WalletLedgerEntryEntity {
  @Field(() => ID)
  id!: string;

  @Field()
  userId!: string;

  @Field(() => WalletLedgerEntryType)
  type!: WalletLedgerEntryType;

  @Field(() => Float)
  amount!: number;

  @Field(() => Float, { nullable: true })
  creditBalanceAfter?: number | null;

  @Field(() => Float, { nullable: true })
  sellerPayableBalanceAfter?: number | null;

  @Field(() => String, { nullable: true })
  raffleId?: string | null;

  @Field(() => String, { nullable: true })
  creditTopUpSessionId?: string | null;

  @Field(() => Boolean, { nullable: true })
  topUpReceiptAvailable?: boolean | null;

  @Field()
  createdAt!: Date;
}

@ObjectType()
export class CreditTopUpResult {
  @Field(() => ID)
  id!: string;

  @Field(() => Float)
  amount!: number;

  @Field()
  redirectUrl!: string;

  @Field()
  status!: string;
}

@ObjectType()
export class CreditTopUpReceiptEntity {
  @Field(() => ID)
  topUpSessionId!: string;

  @Field()
  provider!: string;

  @Field(() => Float)
  amount!: number;

  @Field(() => Float)
  creditedAmount!: number;

  @Field()
  status!: string;

  @Field(() => String, { nullable: true })
  statusDetail?: string | null;

  @Field(() => String, { nullable: true })
  providerPaymentId?: string | null;

  @Field(() => String, { nullable: true })
  providerOrderId?: string | null;

  @Field(() => Int)
  receiptVersion!: number;

  @Field()
  createdAt!: Date;

  @Field(() => Date, { nullable: true })
  approvedAt?: Date | null;

  @Field(() => Date, { nullable: true })
  receiptIssuedAt?: Date | null;

  @Field(() => Float, { nullable: true })
  creditBalanceAfter?: number | null;
}

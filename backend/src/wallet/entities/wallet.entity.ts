import { Field, Float, ID, ObjectType } from '@nestjs/graphql';
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

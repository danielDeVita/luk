import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import { registerEnumType } from '@nestjs/graphql';

export enum ReferralCreditType {
  SIGNUP_BONUS = 'SIGNUP_BONUS',
  FIRST_PURCHASE_BONUS = 'FIRST_PURCHASE_BONUS',
}

export enum ReferralCreditStatus {
  PENDING = 'PENDING',
  CREDITED = 'CREDITED',
  USED = 'USED',
  EXPIRED = 'EXPIRED',
}

registerEnumType(ReferralCreditType, { name: 'ReferralCreditType' });
registerEnumType(ReferralCreditStatus, { name: 'ReferralCreditStatus' });

@ObjectType()
export class ReferralCredit {
  @Field(() => ID)
  id!: string;

  @Field()
  userId!: string;

  @Field()
  refereeId!: string;

  @Field(() => Float)
  amount!: number;

  @Field(() => ReferralCreditType)
  type!: ReferralCreditType;

  @Field(() => ReferralCreditStatus)
  status!: ReferralCreditStatus;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String, { nullable: true })
  ticketId?: string;

  @Field()
  createdAt!: Date;

  @Field(() => Date, { nullable: true })
  processedAt?: Date;
}

@ObjectType()
export class ReferralStats {
  @Field(() => String, { nullable: true })
  referralCode?: string;

  @Field()
  totalReferred!: number;

  @Field(() => Float)
  totalEarned!: number;

  @Field(() => Float)
  pendingCredits!: number;

  @Field(() => Float)
  availableBalance!: number;
}

@ObjectType()
export class ReferredUser {
  @Field(() => ID)
  id!: string;

  @Field()
  nombre!: string;

  @Field()
  apellido!: string;

  @Field()
  createdAt!: Date;

  @Field()
  hasPurchased!: boolean;

  @Field(() => Float)
  earnedFromUser!: number;
}

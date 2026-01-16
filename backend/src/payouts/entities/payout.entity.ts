import {
  ObjectType,
  Field,
  ID,
  Float,
  registerEnumType,
} from '@nestjs/graphql';
import { PayoutStatus } from '@prisma/client';

registerEnumType(PayoutStatus, {
  name: 'PayoutStatus',
  description: 'Status of seller payout',
});

@ObjectType()
export class Payout {
  @Field(() => ID)
  id!: string;

  @Field()
  raffleId!: string;

  @Field()
  sellerId!: string;

  @Field(() => Float)
  grossAmount!: number;

  @Field(() => Float)
  platformFee!: number;

  @Field(() => Float)
  processingFee!: number;

  @Field(() => Float)
  netAmount!: number;

  @Field(() => PayoutStatus)
  status!: PayoutStatus;

  @Field({ nullable: true })
  mpPayoutId?: string;

  @Field({ nullable: true })
  scheduledFor?: Date;

  @Field({ nullable: true })
  processedAt?: Date;

  @Field({ nullable: true })
  failureReason?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field({ nullable: true })
  raffleTitulo?: string;
}

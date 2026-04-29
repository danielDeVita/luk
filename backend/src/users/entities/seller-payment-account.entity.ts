import { Field, ID, ObjectType } from '@nestjs/graphql';
import {
  SellerPaymentAccountIdentifierType,
  SellerPaymentAccountStatus,
} from '../../common/enums';

@ObjectType()
export class SellerPaymentAccount {
  @Field(() => ID)
  id!: string;

  @Field(() => SellerPaymentAccountStatus)
  status!: SellerPaymentAccountStatus;

  @Field(() => String, { nullable: true })
  accountHolderName?: string | null;

  @Field(() => SellerPaymentAccountIdentifierType, { nullable: true })
  accountIdentifierType?: SellerPaymentAccountIdentifierType | null;

  @Field(() => String, { nullable: true })
  maskedAccountIdentifier?: string | null;

  @Field(() => Date, { nullable: true })
  lastSyncedAt?: Date | null;
}

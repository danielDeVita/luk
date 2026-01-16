import { ObjectType, Field, ID } from '@nestjs/graphql';
import { UserRole, MpConnectStatus, DocumentType, KycStatus } from '../../common/enums';

@ObjectType()
export class User {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field()
  nombre!: string;

  @Field()
  apellido!: string;

  @Field(() => UserRole)
  role!: UserRole;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field()
  isDeleted!: boolean;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date | null;

  // OAuth fields
  @Field(() => String, { nullable: true })
  googleId?: string | null;

  @Field(() => String, { nullable: true })
  avatarUrl?: string | null;

  // Email verification
  @Field()
  emailVerified!: boolean;

  @Field(() => Date, { nullable: true })
  emailVerifiedAt?: Date | null;

  // Mercado Pago connection status (not exposing tokens)
  @Field(() => MpConnectStatus)
  mpConnectStatus!: MpConnectStatus;

  @Field(() => String, { nullable: true, description: 'MP user ID (public identifier)' })
  mpUserId?: string | null;

  // Legal & Terms
  @Field(() => Date, { nullable: true })
  termsAcceptedAt?: Date | null;

  @Field(() => String, { nullable: true })
  termsVersion?: string | null;

  // KYC - Identity Verification
  @Field(() => Date, { nullable: true })
  fechaNacimiento?: Date | null;

  @Field(() => DocumentType, { nullable: true })
  documentType?: DocumentType | null;

  @Field(() => String, { nullable: true })
  documentNumber?: string | null;

  @Field(() => String, { nullable: true })
  documentFrontUrl?: string | null;

  @Field(() => String, { nullable: true })
  documentBackUrl?: string | null;

  @Field(() => KycStatus)
  kycStatus!: KycStatus;

  @Field(() => Date, { nullable: true })
  kycSubmittedAt?: Date | null;

  @Field(() => Date, { nullable: true })
  kycVerifiedAt?: Date | null;

  @Field(() => String, { nullable: true })
  kycRejectedReason?: string | null;

  // Address
  @Field(() => String, { nullable: true })
  street?: string | null;

  @Field(() => String, { nullable: true })
  streetNumber?: string | null;

  @Field(() => String, { nullable: true })
  apartment?: string | null;

  @Field(() => String, { nullable: true })
  city?: string | null;

  @Field(() => String, { nullable: true })
  province?: string | null;

  @Field(() => String, { nullable: true })
  postalCode?: string | null;

  @Field(() => String, { nullable: true })
  country?: string | null;

  // Contact
  @Field(() => String, { nullable: true })
  phone?: string | null;

  // CUIT/CUIL
  @Field(() => String, { nullable: true })
  cuitCuil?: string | null;

  // Seller's default sender address for shipping
  @Field(() => String, { nullable: true })
  defaultSenderAddressId?: string | null;
}

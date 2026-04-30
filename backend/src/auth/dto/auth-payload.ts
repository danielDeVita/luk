import { ObjectType, Field, HideField } from '@nestjs/graphql';
import { User } from '../../users/entities/user.entity';

@ObjectType()
export class AuthPayload {
  @Field({ nullable: true })
  token?: string;

  // Internal-only value used to bootstrap httpOnly cookies. Not exposed in GraphQL.
  @HideField()
  refreshToken?: string;

  @Field(() => User)
  user!: User;
}

@ObjectType()
export class LoginPayload extends AuthPayload {
  @Field()
  requiresVerification!: boolean;

  @Field()
  requiresTwoFactor!: boolean;

  @Field({ nullable: true })
  twoFactorChallengeToken?: string;

  @Field({ nullable: true })
  message?: string;
}

@ObjectType()
export class RegisterPayload {
  @Field(() => User)
  user!: User;

  @Field()
  requiresVerification!: boolean;

  @Field({ nullable: true })
  message?: string;
}

@ObjectType()
export class TwoFactorSetupPayload {
  @Field()
  setupToken!: string;

  @Field()
  manualEntryKey!: string;

  @Field()
  otpauthUrl!: string;

  @Field()
  qrCodeDataUrl!: string;
}

@ObjectType()
export class EnableTwoFactorPayload {
  @Field(() => User)
  user!: User;

  @Field(() => [String])
  recoveryCodes!: string[];
}

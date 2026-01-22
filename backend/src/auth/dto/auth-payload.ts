import { ObjectType, Field } from '@nestjs/graphql';
import { User } from '../../users/entities/user.entity';

@ObjectType()
export class AuthPayload {
  @Field({ nullable: true })
  token?: string;

  @Field({
    nullable: true,
    description: 'Refresh token for cross-subdomain deployments',
  })
  refreshToken?: string;

  @Field(() => User)
  user!: User;
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

import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { AuditAction } from '@prisma/client';

registerEnumType(AuditAction, {
  name: 'AuditAction',
  description: 'Types of admin actions that can be audited',
});

@ObjectType()
export class AuditLog {
  @Field(() => ID)
  id!: string;

  @Field()
  adminId!: string;

  @Field(() => AuditAction)
  action!: AuditAction;

  @Field()
  targetType!: string;

  @Field()
  targetId!: string;

  @Field({ nullable: true })
  details?: string;

  @Field({ nullable: true })
  reason?: string;

  @Field()
  createdAt!: Date;

  @Field({ nullable: true })
  adminEmail?: string;
}

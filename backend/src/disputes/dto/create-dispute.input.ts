import { InputType, Field } from '@nestjs/graphql';
import { DisputeType } from '@prisma/client';

@InputType()
export class CreateDisputeInput {
  @Field()
  raffleId!: string;

  @Field(() => String) // GraphQL doesn't auto-map enums in Input unless registered, using String is safer for quick start or register enum
  tipo!: DisputeType;

  @Field()
  titulo!: string;

  @Field()
  descripcion!: string;

  @Field(() => [String], { nullable: true })
  evidencias?: string[];
}

import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
export class Category {
  @Field(() => ID)
  id!: string;

  @Field()
  nombre!: string;

  @Field({ nullable: true })
  descripcion?: string;

  @Field({ nullable: true })
  icono?: string;

  @Field(() => Int)
  orden!: number;

  @Field()
  isActive!: boolean;

  @Field()
  createdAt!: Date;
}

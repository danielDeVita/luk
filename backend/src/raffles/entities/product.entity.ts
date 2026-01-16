import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ProductCondition } from '../../common/enums';
import GraphQLJSON from 'graphql-type-json';

@ObjectType()
export class Product {
  @Field(() => ID)
  id!: string;

  @Field()
  raffleId!: string;

  @Field()
  nombre!: string;

  @Field()
  descripcionDetallada!: string;

  @Field(() => String, { nullable: true })
  categoria?: string;

  @Field(() => ProductCondition)
  condicion!: ProductCondition;

  @Field(() => [String])
  imagenes!: string[];

  @Field(() => GraphQLJSON, { nullable: true })
  especificacionesTecnicas?: Record<string, unknown>;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

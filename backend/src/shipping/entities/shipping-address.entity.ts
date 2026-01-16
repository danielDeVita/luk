import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class ShippingAddress {
  @Field(() => ID)
  id!: string;

  @Field()
  userId!: string;

  @Field()
  label!: string;

  @Field()
  recipientName!: string;

  @Field()
  street!: string;

  @Field()
  number!: string;

  @Field({ nullable: true })
  apartment?: string;

  @Field()
  city!: string;

  @Field()
  province!: string;

  @Field()
  postalCode!: string;

  @Field()
  country!: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  instructions?: string;

  @Field()
  isDefault!: boolean;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

import { Field, Float, InputType } from '@nestjs/graphql';
import { Min } from 'class-validator';

@InputType()
export class CreateCreditTopUpInput {
  @Field(() => Float)
  @Min(100)
  amount!: number;
}

import { InputType, Field, ID } from '@nestjs/graphql';

@InputType()
export class RelaunchRaffleInput {
  @Field(() => ID, { description: 'ID of the cancelled raffle to relaunch' })
  originalRaffleId!: string;

  @Field(() => ID, { description: 'ID of the price reduction suggestion' })
  priceReductionId!: string;

  @Field({ nullable: true, description: 'Override suggested price (optional)' })
  customPrice?: number;

  @Field({ nullable: true, description: 'Days until draw deadline (default: 30)' })
  daysUntilDraw?: number;
}

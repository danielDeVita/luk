import { InputType, Field, ID, Int, Float } from '@nestjs/graphql';
import { IsString, IsOptional, IsPositive, Min, Max } from 'class-validator';

@InputType()
export class RelaunchRaffleInput {
  @Field(() => ID, { description: 'ID of the cancelled raffle to relaunch' })
  @IsString()
  originalRaffleId!: string;

  @Field(() => ID, { description: 'ID of the price reduction suggestion' })
  @IsString()
  priceReductionId!: string;

  @Field(() => Float, {
    nullable: true,
    description: 'Override suggested price (optional)',
  })
  @IsOptional()
  @IsPositive()
  @Min(1)
  @Max(1000000)
  customPrice?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Days until draw deadline (default: 30)',
  })
  @IsOptional()
  @IsPositive()
  @Min(1)
  @Max(90)
  daysUntilDraw?: number;
}

import { InputType, Field, ID, Float } from '@nestjs/graphql';
import {
  IsString,
  IsOptional,
  IsPositive,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { IsAfter } from '../../common/validators/is-after.validator';

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

  @Field(() => String, {
    nullable: true,
    description:
      'Draw deadline date (ISO string). Defaults to 30 days from now.',
  })
  @IsOptional()
  @IsDateString()
  @IsAfter('now', { message: 'La fecha límite debe ser en el futuro' })
  fechaLimite?: string;
}

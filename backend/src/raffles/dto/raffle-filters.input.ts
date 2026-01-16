import { Field, InputType, Float } from '@nestjs/graphql';
import {
  IsOptional,
  IsEnum,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { RaffleStatus, RaffleSort } from '../../common/enums';

@InputType()
export class RaffleFiltersInput {
  @Field(() => RaffleStatus, { nullable: true })
  @IsOptional()
  @IsEnum(RaffleStatus)
  estado?: RaffleStatus;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  categoria?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @Min(0)
  precioMin?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @Min(0)
  precioMax?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  searchTerm?: string;

  @Field(() => RaffleSort, { nullable: true })
  @IsOptional()
  @IsEnum(RaffleSort)
  sortBy?: RaffleSort;
}

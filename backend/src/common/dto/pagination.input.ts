import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

@InputType()
export class PaginationInput {
  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}


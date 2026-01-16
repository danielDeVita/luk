import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsOptional, MinLength, IsInt, Min } from 'class-validator';

@InputType()
export class CreateCategoryInput {
  @Field()
  @IsString()
  @MinLength(2)
  nombre!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  icono?: string;

  @Field(() => Int, { defaultValue: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;
}

@InputType()
export class UpdateCategoryInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(2)
  nombre?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  icono?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @Field({ nullable: true })
  @IsOptional()
  isActive?: boolean;
}

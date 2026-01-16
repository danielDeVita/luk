import { Field, InputType, Int, Float } from '@nestjs/graphql';
import {
  IsNotEmpty,
  IsPositive,
  Min,
  Max,
  IsDateString,
  IsArray,
  IsOptional,
  IsEnum,
  IsString,
  MinLength,
  MaxLength,
  IsUrl,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductCondition, RaffleStatus } from '../../common/enums';
import { RaffleSort } from '../../common/enums';
import { IsAfter } from '../../common/validators/is-after.validator';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class ProductInput {
  @Field()
  @IsString()
  @MinLength(3, { message: 'El nombre del producto debe tener al menos 3 caracteres' })
  @MaxLength(100)
  nombre!: string;

  @Field()
  @IsString()
  @MinLength(20, { message: 'La descripción debe tener al menos 20 caracteres' })
  @MaxLength(2000)
  descripcionDetallada!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  categoria?: string;

  @Field(() => ProductCondition)
  @IsEnum(ProductCondition)
  condicion!: ProductCondition;

  @Field(() => [String])
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe incluir al menos 1 imagen' })
  @ArrayMaxSize(5, { message: 'Máximo 5 imágenes permitidas' })
  @IsUrl({}, { each: true, message: 'Cada imagen debe ser una URL válida' })
  imagenes!: string[];

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  especificacionesTecnicas?: Record<string, any>;
}

@InputType()
export class CreateRaffleInput {
  @Field()
  @IsString()
  @MinLength(10, { message: 'El título debe tener al menos 10 caracteres' })
  @MaxLength(100)
  titulo!: string;

  @Field()
  @IsString()
  @MinLength(50, { message: 'La descripción debe tener al menos 50 caracteres' })
  @MaxLength(5000)
  descripcion!: string;

  @Field(() => ProductInput)
  @ValidateNested()
  @Type(() => ProductInput)
  productData!: ProductInput;

  @Field(() => Int)
  @IsPositive()
  @Min(10, { message: 'Mínimo 10 tickets' })
  @Max(10000, { message: 'Máximo 10,000 tickets' })
  totalTickets!: number;

  @Field(() => Float)
  @IsPositive()
  @Min(1, { message: 'El precio mínimo es 1' })
  @Max(1000000, { message: 'El precio máximo es 1,000,000' })
  precioPorTicket!: number;

  @Field()
  @IsDateString()
  @IsAfter('now', { message: 'La fecha límite debe ser en el futuro' })
  fechaLimite!: string;
}

@InputType()
export class UpdateRaffleInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(100)
  titulo?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(50)
  @MaxLength(5000)
  descripcion?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString()
  @IsAfter('now')
  fechaLimite?: string;
}


@InputType()
export class BuyTicketsInput {
  @Field()
  @IsString()
  raffleId!: string;

  @Field(() => Int)
  @IsPositive()
  @Min(1, { message: 'Debes comprar al menos 1 ticket' })
  @Max(100, { message: 'Máximo 100 tickets por compra' })
  cantidad!: number;
}

@InputType()
export class MarkAsShippedInput {
  @Field()
  @IsString()
  raffleId!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  trackingNumber?: string;
}

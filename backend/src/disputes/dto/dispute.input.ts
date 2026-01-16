import { Field, InputType, Float } from '@nestjs/graphql';
import {
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsString,
  MinLength,
  MaxLength,
  IsArray,
  ArrayMaxSize,
  IsUrl,
  IsUUID,
  Min,
} from 'class-validator';
import { DisputeType, DisputeStatus } from '../../common/enums';

@InputType()
export class OpenDisputeInput {
  @Field()
  @IsUUID()
  raffleId!: string;

  @Field(() => DisputeType)
  @IsEnum(DisputeType)
  tipo!: DisputeType;

  @Field()
  @IsString()
  @MinLength(10, { message: 'El título debe tener al menos 10 caracteres' })
  @MaxLength(100)
  titulo!: string;

  @Field()
  @IsString()
  @MinLength(50, { message: 'La descripción debe tener al menos 50 caracteres' })
  @MaxLength(2000)
  descripcion!: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: 'Máximo 10 imágenes de evidencia' })
  @IsUrl({}, { each: true })
  evidencias?: string[];
}

@InputType()
export class RespondDisputeInput {
  @Field()
  @IsString()
  @MinLength(20, { message: 'La respuesta debe tener al menos 20 caracteres' })
  @MaxLength(2000)
  respuesta!: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  evidencias?: string[];
}

@InputType()
export class ResolveDisputeInput {
  @Field(() => DisputeStatus)
  @IsEnum(DisputeStatus, {
    message: 'La decisión debe ser RESUELTA_COMPRADOR, RESUELTA_VENDEDOR o RESUELTA_PARCIAL'
  })
  decision!: DisputeStatus;

  @Field()
  @IsString()
  @MinLength(20, { message: 'La resolución debe tener al menos 20 caracteres' })
  @MaxLength(1000)
  resolucion!: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @Min(0)
  montoReembolsado?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @Min(0)
  montoPagadoVendedor?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNotes?: string;
}

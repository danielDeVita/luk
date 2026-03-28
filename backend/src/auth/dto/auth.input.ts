import { Field, InputType } from '@nestjs/graphql';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  Matches,
  MaxLength,
  MinLength,
  IsDateString,
  IsBoolean,
} from 'class-validator';

@InputType()
export class RegisterInput {
  @Field()
  @IsEmail({}, { message: 'Debe ser un email válido' })
  @MaxLength(255)
  email!: string;

  @Field()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'La contraseña debe contener al menos una mayúscula, una minúscula y un número',
  })
  password!: string;

  @Field()
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(50)
  nombre!: string;

  @Field()
  @IsString()
  @MinLength(2, { message: 'El apellido debe tener al menos 2 caracteres' })
  @MaxLength(50)
  apellido!: string;

  @Field()
  @IsDateString({}, { message: 'Fecha de nacimiento inválida' })
  fechaNacimiento!: string;

  @Field()
  @IsBoolean()
  acceptTerms!: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  promotionToken?: string;
}

@InputType()
export class LoginInput {
  @Field()
  @IsEmail({}, { message: 'Debe ser un email válido' })
  email!: string;

  @Field()
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @IsString()
  password!: string;
}

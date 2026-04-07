import { InputType, Field, Int } from '@nestjs/graphql';
import {
  IsOptional,
  IsString,
  MinLength,
  Matches,
  IsEnum,
  MaxLength,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { DocumentType } from '../../common/enums';

@InputType()
export class UpdateProfileInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(2)
  nombre?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(2)
  apellido?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  phone?: string;
}

@InputType()
export class ChangePasswordInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  oldPassword!: string;

  @Field()
  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/, { message: 'Debe contener al menos una mayúscula' })
  @Matches(/[a-z]/, { message: 'Debe contener al menos una minúscula' })
  @Matches(/[0-9]/, { message: 'Debe contener al menos un número' })
  newPassword!: string;
}

@InputType()
export class UpdateKycInput {
  @Field(() => DocumentType)
  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @Field()
  @IsString()
  @MinLength(7, { message: 'Número de documento inválido' })
  @MaxLength(20, { message: 'Número de documento inválido' })
  documentNumber!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  documentFrontUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  documentBackUrl?: string;

  // Address fields
  @Field()
  @IsString()
  @MinLength(2)
  street!: string;

  @Field()
  @IsString()
  streetNumber!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  apartment?: string;

  @Field()
  @IsString()
  @MinLength(2)
  city!: string;

  @Field()
  @IsString()
  @MinLength(2)
  province!: string;

  @Field()
  @IsString()
  @MinLength(4)
  postalCode!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  phone?: string;

  // CUIT/CUIL for sellers (optional at first)
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}-\d{8}-\d$/, {
    message: 'CUIT/CUIL debe tener el formato XX-XXXXXXXX-X',
  })
  cuitCuil?: string;
}

@InputType()
export class AcceptTermsInput {
  @Field()
  @IsString()
  termsVersion!: string;
}

@InputType()
export class UpdateAvatarInput {
  @Field()
  @IsString()
  @IsNotEmpty({ message: 'La URL del avatar es requerida' })
  avatarUrl!: string;
}

@InputType()
export class CreateSellerReviewInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  raffleId!: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comentario?: string;
}

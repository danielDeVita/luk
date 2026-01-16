import { InputType, Field } from '@nestjs/graphql';
import {
  IsString,
  IsOptional,
  MinLength,
  IsBoolean,
  Matches,
} from 'class-validator';

@InputType()
export class CreateShippingAddressInput {
  @Field({ defaultValue: 'Principal' })
  @IsOptional()
  @IsString()
  label?: string;

  @Field()
  @IsString()
  @MinLength(2)
  recipientName!: string;

  @Field()
  @IsString()
  @MinLength(3)
  street!: string;

  @Field()
  @IsString()
  number!: string;

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
  @Matches(/^[A-Z]?\d{4}[A-Z]{3}?$|^\d{4}$/, {
    message: 'Codigo postal invalido',
  })
  postalCode!: string;

  @Field({ defaultValue: 'Argentina' })
  @IsOptional()
  @IsString()
  country?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  phone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  instructions?: string;

  @Field({ defaultValue: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

@InputType()
export class UpdateShippingAddressInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  label?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(2)
  recipientName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(3)
  street?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  number?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  apartment?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(2)
  city?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(2)
  province?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  country?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  phone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  instructions?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

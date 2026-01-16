import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  // Database - Critical
  @IsString()
  DATABASE_URL!: string;

  // Application
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  @Min(1)
  PORT: number = 3001;

  @IsString()
  @IsOptional()
  FRONTEND_URL: string = 'http://localhost:3000';

  @IsString()
  @IsOptional()
  BACKEND_URL: string = 'http://localhost:3001';

  // Authentication - Critical
  @IsString()
  JWT_SECRET!: string;

  // Stripe - Critical
  @IsString()
  STRIPE_SECRET_KEY!: string;

  @IsString()
  STRIPE_WEBHOOK_SECRET!: string;

  @IsString()
  @IsOptional()
  STRIPE_PUBLISHABLE_KEY!: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  STRIPE_PLATFORM_FEE_PERCENT: number = 4;

  // Cloudinary - Critical
  @IsString()
  CLOUDINARY_CLOUD_NAME!: string;

  @IsString()
  @IsOptional()
  CLOUDINARY_API_KEY!: string;

  @IsString()
  @IsOptional()
  CLOUDINARY_API_SECRET!: string;

  @IsString()
  @IsOptional()
  CLOUDINARY_UPLOAD_PRESET: string = 'raffle_images';

  // Email (Resend) - Critical
  @IsString()
  RESEND_API_KEY!: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM: string = 'rifas@tudominio.com';

  @IsString()
  @IsOptional()
  EMAIL_FROM_NAME: string = 'Plataforma de Rifas';

  // Rate Limiting
  @IsNumber()
  @IsOptional()
  @Min(1)
  THROTTLE_TTL: number = 60;

  @IsNumber()
  @IsOptional()
  @Min(1)
  THROTTLE_LIMIT: number = 100;

  // Logging
  @IsString()
  @IsOptional()
  LOG_LEVEL: string = 'info';

  // Cron Jobs
  @IsBoolean()
  @IsOptional()
  ENABLE_CRON_JOBS: boolean = true;

  // GraphQL
  @IsBoolean()
  @IsOptional()
  GRAPHQL_PLAYGROUND: boolean = true;

  @IsBoolean()
  @IsOptional()
  GRAPHQL_DEBUG: boolean = true;

  // CORS
  @IsString()
  @IsOptional()
  CORS_ORIGIN: string = 'http://localhost:3000';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const missingVars = errors
      .map(
        (error) =>
          `  - ${error.property}: ${Object.values(error.constraints || {}).join(', ')}`,
      )
      .join('\n');

    throw new Error(
      `\n\n❌ Missing or invalid environment variables:\n${missingVars}\n\nPlease check your .env file.\n`,
    );
  }

  return validatedConfig;
}

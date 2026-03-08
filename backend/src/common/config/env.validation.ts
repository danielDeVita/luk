import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  validateSync,
} from 'class-validator';
import {
  DEFAULT_EMAIL_FROM,
  DEFAULT_EMAIL_FROM_NAME,
} from '../constants/brand.constants';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  // Database - Critical
  @IsString()
  @IsNotEmpty()
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
  @IsNotEmpty()
  JWT_SECRET!: string;

  // Google OAuth
  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID: string = '';

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_SECRET: string = '';

  @IsString()
  @IsOptional()
  GOOGLE_CALLBACK_URL: string = 'http://localhost:3001/auth/google/callback';

  // Mercado Pago
  @IsString()
  @IsOptional()
  MP_ACCESS_TOKEN: string = '';

  @IsNumber()
  @IsOptional()
  @Min(0)
  MP_PLATFORM_FEE_PERCENT: number = 4;

  @IsBoolean()
  @IsOptional()
  MP_MOCK_MODE: boolean = false;

  @IsString()
  @IsOptional()
  MP_CLIENT_ID: string = '';

  @IsString()
  @IsOptional()
  MP_CLIENT_SECRET: string = '';

  @IsString()
  @IsOptional()
  MP_WEBHOOK_SECRET: string = '';

  // Cloudinary - Critical
  @IsString()
  @IsNotEmpty()
  CLOUDINARY_CLOUD_NAME!: string;

  @IsString()
  @IsNotEmpty()
  CLOUDINARY_API_KEY!: string;

  @IsString()
  @IsNotEmpty()
  CLOUDINARY_API_SECRET!: string;

  // Email (Brevo)
  @IsString()
  @IsOptional()
  BREVO_API_KEY: string = '';

  @IsString()
  @IsOptional()
  EMAIL_FROM: string = DEFAULT_EMAIL_FROM;

  @IsString()
  @IsOptional()
  EMAIL_FROM_NAME: string = DEFAULT_EMAIL_FROM_NAME;

  // Encryption - Critical
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-fA-F0-9]{64}$/, {
    message: 'must be exactly 64 hexadecimal characters',
  })
  ENCRYPTION_KEY!: string;

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

  // Optional integrations
  @IsString()
  @IsOptional()
  SENTRY_DSN: string = '';

  @IsString()
  @IsOptional()
  REDIS_URL: string = '';
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

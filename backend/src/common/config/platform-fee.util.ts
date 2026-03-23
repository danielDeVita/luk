import { ConfigService } from '@nestjs/config';

const PLATFORM_FEE_PERCENT_KEY = 'PLATFORM_FEE_PERCENT';

/**
 * Reads the platform fee percent from configuration and guarantees a valid numeric value.
 */
export function getPlatformFeePercent(configService: ConfigService): number {
  const rawValue = configService.get<string | number>(PLATFORM_FEE_PERCENT_KEY);
  const normalizedValue =
    typeof rawValue === 'number' ? rawValue : Number(rawValue);

  if (!Number.isFinite(normalizedValue) || normalizedValue < 0) {
    throw new Error(
      `${PLATFORM_FEE_PERCENT_KEY} env var is required and must be a non-negative number`,
    );
  }

  return normalizedValue;
}

/**
 * Returns the platform fee as a decimal rate suitable for monetary calculations.
 */
export function getPlatformFeeRate(configService: ConfigService): number {
  return getPlatformFeePercent(configService) / 100;
}

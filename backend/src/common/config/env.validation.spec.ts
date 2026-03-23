import 'reflect-metadata';
import { validate } from './env.validation';

describe('env.validation', () => {
  const baseConfig = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_SECRET: 'super-secret-jwt-key-with-minimum-length',
    PLATFORM_FEE_PERCENT: '4',
    CLOUDINARY_CLOUD_NAME: 'cloud',
    CLOUDINARY_API_KEY: 'key',
    CLOUDINARY_API_SECRET: 'secret',
    ENCRYPTION_KEY:
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  };

  it('accepts PLATFORM_FEE_PERCENT when provided', () => {
    const result = validate(baseConfig);

    expect(result.PLATFORM_FEE_PERCENT).toBe(4);
  });

  it('throws when PLATFORM_FEE_PERCENT is missing', () => {
    const invalidConfig = { ...baseConfig };
    delete (invalidConfig as Partial<typeof baseConfig>).PLATFORM_FEE_PERCENT;

    expect(() => validate(invalidConfig)).toThrow('PLATFORM_FEE_PERCENT');
  });
});

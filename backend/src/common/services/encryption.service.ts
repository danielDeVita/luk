import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encrypt, decrypt, isEncrypted } from '../utils/encryption.util';

/**
 * Fields that contain PII and should be encrypted at rest.
 * These are the field names as they appear in Prisma models.
 */
export const PII_FIELDS = [
  'mpAccessToken',
  'mpRefreshToken',
  'documentNumber',
  'cuitCuil',
] as const;

export type PIIField = (typeof PII_FIELDS)[number];

@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private isEnabled = false;

  constructor(private configService: ConfigService) {}

  onModuleInit(): void {
    const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');

    if (encryptionKey && encryptionKey.length === 64) {
      this.isEnabled = true;
      this.logger.log('PII encryption is ENABLED');
    } else {
      this.isEnabled = false;
      this.logger.warn(
        'PII encryption is DISABLED - ENCRYPTION_KEY not set or invalid. ' +
          'Set a 64-character hex key in .env for production.',
      );
    }
  }

  /**
   * Checks if encryption is enabled.
   */
  get enabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Encrypts a value if encryption is enabled.
   * @param value - The plaintext value
   * @returns Encrypted value or original value if encryption is disabled
   */
  encrypt(value: string | null | undefined): string | null {
    if (!value) return null;
    if (!this.isEnabled) return value;

    // Don't double-encrypt
    if (isEncrypted(value)) {
      return value;
    }

    return encrypt(value);
  }

  /**
   * Decrypts a value if encryption is enabled.
   * @param value - The encrypted value
   * @returns Decrypted value or original value if encryption is disabled
   */
  decrypt(value: string | null | undefined): string | null {
    if (!value) return null;
    if (!this.isEnabled) return value;

    // Only decrypt if it looks encrypted
    if (!isEncrypted(value)) {
      return value;
    }

    return decrypt(value);
  }

  /**
   * Encrypts all PII fields in a user data object.
   * @param data - Object containing user data
   * @returns Object with encrypted PII fields
   */
  encryptUserPII<T extends Record<string, unknown>>(data: T): T {
    if (!this.isEnabled) return data;

    const result: Record<string, unknown> = { ...data };

    for (const field of PII_FIELDS) {
      if (field in result && typeof result[field] === 'string') {
        result[field] = this.encrypt(result[field] as string);
      }
    }

    return result as T;
  }

  /**
   * Decrypts all PII fields in a user data object.
   * @param data - Object containing encrypted user data
   * @returns Object with decrypted PII fields
   */
  decryptUserPII<T extends Record<string, unknown>>(data: T): T {
    if (!this.isEnabled) return data;

    const result: Record<string, unknown> = { ...data };

    for (const field of PII_FIELDS) {
      if (field in result && typeof result[field] === 'string') {
        result[field] = this.decrypt(result[field] as string);
      }
    }

    return result as T;
  }

  /**
   * Masks a sensitive value for logging purposes.
   * Shows first and last 2 characters only.
   * @param value - The value to mask
   * @returns Masked string like "ab****yz"
   */
  mask(value: string | null | undefined): string {
    if (!value) return '[empty]';
    if (value.length <= 4) return '****';
    return `${value.slice(0, 2)}****${value.slice(-2)}`;
  }
}

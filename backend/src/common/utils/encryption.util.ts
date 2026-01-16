import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';

const logger = new Logger('EncryptionUtil');

// AES-256-GCM encryption constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const ENCODING: BufferEncoding = 'base64';

/**
 * Gets the encryption key from environment variable.
 * Key must be 64 hex characters (32 bytes / 256 bits).
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (256 bits)');
  }

  return Buffer.from(key, 'hex');
}

/**
 * Encrypts a string using AES-256-GCM.
 * Returns base64-encoded string: IV + AuthTag + CipherText
 *
 * @param plaintext - The string to encrypt
 * @returns Base64-encoded encrypted string, or null if plaintext is null/undefined
 */
export function encrypt(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined || plaintext === '') {
    return null;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Combine IV + AuthTag + CipherText
    const combined = Buffer.concat([iv, authTag, encrypted]);

    return combined.toString(ENCODING);
  } catch (error) {
    logger.error(`Encryption failed: ${(error as Error).message}`);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 *
 * @param encryptedText - Base64-encoded encrypted string (IV + AuthTag + CipherText)
 * @returns Decrypted plaintext string, or null if input is null/undefined
 */
export function decrypt(
  encryptedText: string | null | undefined,
): string | null {
  if (
    encryptedText === null ||
    encryptedText === undefined ||
    encryptedText === ''
  ) {
    return null;
  }

  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedText, ENCODING);

    // Extract IV, AuthTag, and CipherText
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    logger.error(`Decryption failed: ${(error as Error).message}`);
    // Return null instead of throwing to handle corrupted/invalid data gracefully
    return null;
  }
}

/**
 * Checks if a value appears to be encrypted (base64 with sufficient length).
 * This is a heuristic check and not foolproof.
 *
 * @param value - The value to check
 * @returns True if the value appears to be encrypted
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;

  // Minimum length: IV (16) + AuthTag (16) + at least 1 byte ciphertext = 33 bytes
  // Base64 encoded: ceil(33 / 3) * 4 = 44 characters minimum
  if (value.length < 44) return false;

  // Check if it's valid base64
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return base64Regex.test(value);
}

/**
 * Generates a new random encryption key (for initial setup).
 * Should only be used once and stored securely.
 *
 * @returns 64-character hex string (256-bit key)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

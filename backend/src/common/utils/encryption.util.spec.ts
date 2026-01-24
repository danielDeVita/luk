import {
  encrypt,
  decrypt,
  isEncrypted,
  generateEncryptionKey,
} from './encryption.util';

describe('EncryptionUtil', () => {
  const VALID_ENCRYPTION_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes = 256 bits

  beforeEach(() => {
    // Set a valid encryption key for tests
    process.env.ENCRYPTION_KEY = VALID_ENCRYPTION_KEY;
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  describe('encrypt', () => {
    it('should encrypt a plaintext string', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encrypt(plaintext);

      expect(encrypted).not.toBeNull();
      expect(encrypted).not.toBe(plaintext);
      expect(typeof encrypted).toBe('string');
    });

    it('should return null for null input', () => {
      expect(encrypt(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(encrypt(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(encrypt('')).toBeNull();
    });

    it('should produce different ciphertext for same plaintext (due to random IV)', () => {
      const plaintext = 'Same text';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle unicode characters', () => {
      const plaintext = '¡Hola! 你好 🎉';
      const encrypted = encrypt(plaintext);

      expect(encrypted).not.toBeNull();
      expect(encrypted).not.toBe(plaintext);
    });

    it('should handle very long strings', () => {
      const plaintext = 'A'.repeat(10000);
      const encrypted = encrypt(plaintext);

      expect(encrypted).not.toBeNull();
    });

    it('should throw error when ENCRYPTION_KEY is not set', () => {
      delete process.env.ENCRYPTION_KEY;

      expect(() => encrypt('test')).toThrow('Encryption failed');
    });

    it('should throw error when ENCRYPTION_KEY is invalid length', () => {
      process.env.ENCRYPTION_KEY = 'short';

      expect(() => encrypt('test')).toThrow('Encryption failed');
    });
  });

  describe('decrypt', () => {
    it('should decrypt an encrypted string back to original', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should return null for null input', () => {
      expect(decrypt(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(decrypt(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(decrypt('')).toBeNull();
    });

    it('should handle unicode characters', () => {
      const plaintext = '¡Hola! 你好 🎉';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should return null for corrupted ciphertext', () => {
      const encrypted = encrypt('test');
      const corrupted = encrypted!.slice(0, -5) + 'XXXXX';

      expect(decrypt(corrupted)).toBeNull();
    });

    it('should return null for invalid base64', () => {
      expect(decrypt('not-valid-base64!!!')).toBeNull();
    });

    it('should return null for truncated ciphertext', () => {
      const encrypted = encrypt('test');
      const truncated = encrypted!.slice(0, 10);

      expect(decrypt(truncated)).toBeNull();
    });

    it('should return null when decrypting with wrong key', () => {
      const plaintext = 'Secret message';
      const encrypted = encrypt(plaintext);

      // Change the key
      process.env.ENCRYPTION_KEY = 'b'.repeat(64);

      // Should fail to decrypt with wrong key
      expect(decrypt(encrypted)).toBeNull();
    });
  });

  describe('encrypt/decrypt roundtrip', () => {
    it('should correctly roundtrip various data types', () => {
      const testCases = [
        'simple text',
        '12345678901234567890', // Numbers as string (like DNI)
        '20-12345678-9', // CUIT format
        'Av. Corrientes 1234, Piso 5, CABA', // Address
        '+54 11 1234-5678', // Phone number
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', // Token-like
        'Special chars: !@#$%^&*()_+-=[]{}|;:",.<>?/',
        '   leading and trailing spaces   ',
        'Line1\nLine2\nLine3', // Multiline
      ];

      for (const plaintext of testCases) {
        const encrypted = encrypt(plaintext);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(plaintext);
      }
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted values', () => {
      const encrypted = encrypt('test');
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isEncrypted(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isEncrypted(undefined)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isEncrypted('')).toBe(false);
    });

    it('should return false for short strings', () => {
      expect(isEncrypted('short')).toBe(false);
    });

    it('should return false for non-base64 strings', () => {
      expect(isEncrypted('This is not encrypted at all!!!')).toBe(false);
    });

    it('should return false for plaintext that looks like base64 but is too short', () => {
      expect(isEncrypted('SGVsbG8=')).toBe(false); // "Hello" in base64, too short
    });

    it('should return true for valid base64 of sufficient length', () => {
      // Valid base64 of 44+ chars
      const validBase64 = 'A'.repeat(44);
      expect(isEncrypted(validBase64)).toBe(true);
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate a 64-character hex string', () => {
      const key = generateEncryptionKey();

      expect(typeof key).toBe('string');
      expect(key.length).toBe(64);
    });

    it('should generate valid hex characters only', () => {
      const key = generateEncryptionKey();
      const hexRegex = /^[0-9a-f]+$/;

      expect(hexRegex.test(key)).toBe(true);
    });

    it('should generate unique keys each time', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();

      expect(key1).not.toBe(key2);
    });

    it('should generate keys that can be used for encryption', () => {
      const newKey = generateEncryptionKey();
      process.env.ENCRYPTION_KEY = newKey;

      const plaintext = 'Test with generated key';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService, PII_FIELDS } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;
  let configService: jest.Mocked<ConfigService>;

  const VALID_ENCRYPTION_KEY = 'a'.repeat(64);

  const createMockConfigService = (encryptionKey: string | undefined) => ({
    get: jest.fn((key: string) => {
      if (key === 'ENCRYPTION_KEY') {
        return encryptionKey;
      }
      return undefined;
    }),
  });

  describe('with encryption enabled', () => {
    beforeEach(async () => {
      process.env.ENCRYPTION_KEY = VALID_ENCRYPTION_KEY;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          {
            provide: ConfigService,
            useValue: createMockConfigService(VALID_ENCRYPTION_KEY),
          },
        ],
      }).compile();

      service = module.get<EncryptionService>(EncryptionService);
      configService = module.get(ConfigService);
      service.onModuleInit();
    });

    afterEach(() => {
      delete process.env.ENCRYPTION_KEY;
    });

    describe('enabled', () => {
      it('should return true when valid encryption key is set', () => {
        expect(service.enabled).toBe(true);
      });
    });

    describe('encrypt', () => {
      it('should encrypt a string value', () => {
        const plaintext = 'Sensitive data';
        const encrypted = service.encrypt(plaintext);

        expect(encrypted).not.toBeNull();
        expect(encrypted).not.toBe(plaintext);
      });

      it('should return null for null input', () => {
        expect(service.encrypt(null)).toBeNull();
      });

      it('should return null for undefined input', () => {
        expect(service.encrypt(undefined)).toBeNull();
      });

      it('should return null for empty string', () => {
        expect(service.encrypt('')).toBeNull();
      });

      it('should not double-encrypt already encrypted values', () => {
        const plaintext = 'Sensitive data';
        const encrypted1 = service.encrypt(plaintext);
        const encrypted2 = service.encrypt(encrypted1);

        // Should return the same value, not double-encrypted
        expect(encrypted2).toBe(encrypted1);

        // Should still decrypt correctly
        const decrypted = service.decrypt(encrypted2);
        expect(decrypted).toBe(plaintext);
      });
    });

    describe('decrypt', () => {
      it('should decrypt an encrypted value back to original', () => {
        const plaintext = 'Sensitive data';
        const encrypted = service.encrypt(plaintext);
        const decrypted = service.decrypt(encrypted);

        expect(decrypted).toBe(plaintext);
      });

      it('should return null for null input', () => {
        expect(service.decrypt(null)).toBeNull();
      });

      it('should return null for undefined input', () => {
        expect(service.decrypt(undefined)).toBeNull();
      });

      it('should return plaintext values as-is if not encrypted', () => {
        const plaintext = 'Not encrypted';
        const result = service.decrypt(plaintext);

        expect(result).toBe(plaintext);
      });
    });

    describe('encryptUserPII', () => {
      it('should encrypt all PII fields in user data', () => {
        const userData = {
          id: 'user-123',
          email: 'test@example.com',
          mpAccessToken: 'mp-token-secret',
          mpRefreshToken: 'mp-refresh-secret',
          documentNumber: '12345678',
          cuitCuil: '20-12345678-9',
          street: 'Av. Corrientes',
          streetNumber: '1234',
          apartment: '5A',
          city: 'Buenos Aires',
          province: 'CABA',
          postalCode: '1043',
          phone: '+54 11 1234-5678',
        };

        const encrypted = service.encryptUserPII(userData);

        // Non-PII fields should be unchanged
        expect(encrypted.id).toBe(userData.id);
        expect(encrypted.email).toBe(userData.email);

        // PII fields should be encrypted
        expect(encrypted.mpAccessToken).not.toBe(userData.mpAccessToken);
        expect(encrypted.mpRefreshToken).not.toBe(userData.mpRefreshToken);
        expect(encrypted.documentNumber).not.toBe(userData.documentNumber);
        expect(encrypted.cuitCuil).not.toBe(userData.cuitCuil);
        expect(encrypted.street).not.toBe(userData.street);
        expect(encrypted.streetNumber).not.toBe(userData.streetNumber);
        expect(encrypted.apartment).not.toBe(userData.apartment);
        expect(encrypted.city).not.toBe(userData.city);
        expect(encrypted.province).not.toBe(userData.province);
        expect(encrypted.postalCode).not.toBe(userData.postalCode);
        expect(encrypted.phone).not.toBe(userData.phone);
      });

      it('should handle partial user data', () => {
        const userData = {
          id: 'user-123',
          phone: '+54 11 1234-5678',
        };

        const encrypted = service.encryptUserPII(userData);

        expect(encrypted.id).toBe(userData.id);
        expect(encrypted.phone).not.toBe(userData.phone);
      });

      it('should handle null/undefined values in fields', () => {
        const userData = {
          id: 'user-123',
          phone: null as string | null,
          city: undefined as string | undefined,
        };

        const encrypted = service.encryptUserPII(userData);

        expect(encrypted.id).toBe(userData.id);
        expect(encrypted.phone).toBeNull();
        expect(encrypted.city).toBeUndefined();
      });

      it('should not modify the original object', () => {
        const userData = {
          phone: '+54 11 1234-5678',
        };
        const originalPhone = userData.phone;

        service.encryptUserPII(userData);

        expect(userData.phone).toBe(originalPhone);
      });
    });

    describe('decryptUserPII', () => {
      it('should decrypt all PII fields in user data', () => {
        const originalData = {
          id: 'user-123',
          email: 'test@example.com',
          mpAccessToken: 'mp-token-secret',
          documentNumber: '12345678',
          phone: '+54 11 1234-5678',
        };

        const encrypted = service.encryptUserPII(originalData);
        const decrypted = service.decryptUserPII(encrypted);

        expect(decrypted.id).toBe(originalData.id);
        expect(decrypted.email).toBe(originalData.email);
        expect(decrypted.mpAccessToken).toBe(originalData.mpAccessToken);
        expect(decrypted.documentNumber).toBe(originalData.documentNumber);
        expect(decrypted.phone).toBe(originalData.phone);
      });

      it('should handle already decrypted data (idempotent)', () => {
        const userData = {
          phone: '+54 11 1234-5678',
        };

        const result = service.decryptUserPII(userData);

        expect(result.phone).toBe(userData.phone);
      });
    });
  });

  describe('with encryption disabled', () => {
    beforeEach(async () => {
      delete process.env.ENCRYPTION_KEY;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          {
            provide: ConfigService,
            useValue: createMockConfigService(undefined),
          },
        ],
      }).compile();

      service = module.get<EncryptionService>(EncryptionService);
      service.onModuleInit();
    });

    describe('enabled', () => {
      it('should return false when no encryption key is set', () => {
        expect(service.enabled).toBe(false);
      });
    });

    describe('encrypt', () => {
      it('should return original value when encryption is disabled', () => {
        const plaintext = 'Sensitive data';
        const result = service.encrypt(plaintext);

        expect(result).toBe(plaintext);
      });

      it('should still return null for null input', () => {
        expect(service.encrypt(null)).toBeNull();
      });
    });

    describe('decrypt', () => {
      it('should return original value when encryption is disabled', () => {
        const value = 'Some value';
        const result = service.decrypt(value);

        expect(result).toBe(value);
      });
    });

    describe('encryptUserPII', () => {
      it('should return data unchanged when encryption is disabled', () => {
        const userData = {
          id: 'user-123',
          phone: '+54 11 1234-5678',
          documentNumber: '12345678',
        };

        const result = service.encryptUserPII(userData);

        expect(result.phone).toBe(userData.phone);
        expect(result.documentNumber).toBe(userData.documentNumber);
      });
    });

    describe('decryptUserPII', () => {
      it('should return data unchanged when encryption is disabled', () => {
        const userData = {
          id: 'user-123',
          phone: '+54 11 1234-5678',
        };

        const result = service.decryptUserPII(userData);

        expect(result).toEqual(userData);
      });
    });
  });

  describe('with invalid encryption key', () => {
    it('should disable encryption when key is too short', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          {
            provide: ConfigService,
            useValue: createMockConfigService('shortkey'),
          },
        ],
      }).compile();

      service = module.get<EncryptionService>(EncryptionService);
      service.onModuleInit();

      expect(service.enabled).toBe(false);
    });

    it('should disable encryption when key is too long', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          {
            provide: ConfigService,
            useValue: createMockConfigService('a'.repeat(100)),
          },
        ],
      }).compile();

      service = module.get<EncryptionService>(EncryptionService);
      service.onModuleInit();

      expect(service.enabled).toBe(false);
    });
  });

  describe('mask', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          {
            provide: ConfigService,
            useValue: createMockConfigService(VALID_ENCRYPTION_KEY),
          },
        ],
      }).compile();

      service = module.get<EncryptionService>(EncryptionService);
    });

    it('should mask a value showing only first and last 2 characters', () => {
      expect(service.mask('12345678')).toBe('12****78');
    });

    it('should return [empty] for null', () => {
      expect(service.mask(null)).toBe('[empty]');
    });

    it('should return [empty] for undefined', () => {
      expect(service.mask(undefined)).toBe('[empty]');
    });

    it('should return [empty] for empty string', () => {
      expect(service.mask('')).toBe('[empty]');
    });

    it('should return **** for strings 4 chars or less', () => {
      expect(service.mask('abc')).toBe('****');
      expect(service.mask('abcd')).toBe('****');
    });

    it('should correctly mask 5-character strings', () => {
      expect(service.mask('abcde')).toBe('ab****de');
    });

    it('should correctly mask long strings', () => {
      expect(service.mask('20-12345678-9')).toBe('20****-9');
    });
  });

  describe('PII_FIELDS constant', () => {
    it('should contain all expected PII fields', () => {
      const expectedFields = [
        'mpAccessToken',
        'mpRefreshToken',
        'documentNumber',
        'cuitCuil',
        'street',
        'streetNumber',
        'apartment',
        'city',
        'province',
        'postalCode',
        'phone',
      ];

      expect(PII_FIELDS).toEqual(expectedFields);
    });

    it('should have 11 PII fields defined', () => {
      expect(PII_FIELDS.length).toBe(11);
    });
  });
});

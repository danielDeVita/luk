import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { generateSync } from 'otplib';
import { TwoFactorService } from './two-factor.service';
import { EncryptionService } from '../common/services/encryption.service';

jest.mock('otplib', () => ({
  generateSecret: jest.fn(() => 'SECRET123'),
  generateURI: jest.fn(
    ({
      issuer,
      label,
      secret,
    }: {
      issuer: string;
      label: string;
      secret: string;
    }) => `otpauth://totp/${issuer}:${label}?secret=${secret}`,
  ),
  verifySync: jest.fn(({ token }: { token: string }) => ({
    valid: token === '123456',
    delta: token === '123456' ? 0 : null,
  })),
  generateSync: jest.fn(() => '123456'),
}));

describe('TwoFactorService', () => {
  let service: TwoFactorService;

  const mockEncryptionService = {
    encrypt: jest.fn((value: string) => `enc:${value}`),
    decrypt: jest.fn((value: string) => value.replace(/^enc:/, '')),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-jwt-secret',
        }),
      ],
      providers: [
        TwoFactorService,
        { provide: EncryptionService, useValue: mockEncryptionService },
      ],
    }).compile();

    service = module.get<TwoFactorService>(TwoFactorService);
  });

  it('creates a valid setup payload with QR data', async () => {
    const result = await service.createSetup({
      id: 'user-1',
      email: 'test@example.com',
    });

    expect(result.setupToken).toBeTruthy();
    expect(result.manualEntryKey).toBeTruthy();
    expect(result.otpauthUrl).toContain('otpauth://totp/');
    expect(result.qrCodeDataUrl).toContain('data:image/png;base64,');

    const payload = service.validateSetupToken(result.setupToken);
    expect(payload.userId).toBe('user-1');
    expect(payload.email).toBe('test@example.com');
    expect(payload.secret).toBe(result.manualEntryKey);
  });

  it('verifies valid TOTP codes against the generated secret', async () => {
    const setup = await service.createSetup({
      id: 'user-1',
      email: 'test@example.com',
    });
    const { secret } = service.validateSetupToken(setup.setupToken);
    const code = generateSync({ secret, period: 30 });

    expect(service.verifyTotp(code, secret)).toBe(true);
    expect(service.verifyTotp('000000', secret)).toBe(false);
  });

  it('consumes recovery codes only once', () => {
    const recoveryCodes = service.generateRecoveryCodes();
    const recoveryHashes = service.hashRecoveryCodes(recoveryCodes);

    const firstAttempt = service.consumeRecoveryCode(
      recoveryCodes[0],
      recoveryHashes,
    );

    expect(firstAttempt.matched).toBe(true);
    expect(firstAttempt.remainingHashes).toHaveLength(
      recoveryHashes.length - 1,
    );

    const secondAttempt = service.consumeRecoveryCode(
      recoveryCodes[0],
      firstAttempt.remainingHashes,
    );

    expect(secondAttempt.matched).toBe(false);
  });

  it('creates and validates login challenge tokens', () => {
    const challengeToken = service.createChallengeToken('user-1');
    const payload = service.validateChallengeToken(challengeToken);

    expect(payload.userId).toBe('user-1');
  });

  it('encrypts and decrypts secrets through the shared encryption service', () => {
    const encrypted = service.encryptSecret('SECRET123');
    const decrypted = service.decryptSecret(encrypted);

    expect(encrypted).toBe('enc:SECRET123');
    expect(decrypted).toBe('SECRET123');
  });
});

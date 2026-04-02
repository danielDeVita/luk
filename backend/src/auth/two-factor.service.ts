import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { EncryptionService } from '../common/services/encryption.service';

const TWO_FACTOR_ISSUER = 'LUK';
const TWO_FACTOR_SETUP_TOKEN_TTL = '10m';
const TWO_FACTOR_CHALLENGE_TOKEN_TTL = '10m';
const RECOVERY_CODES_COUNT = 8;

type TokenPurpose = 'two-factor-setup' | 'two-factor-login';

interface TwoFactorSetupTokenPayload {
  sub: string;
  email: string;
  purpose: 'two-factor-setup';
  secret: string;
}

interface TwoFactorChallengeTokenPayload {
  sub: string;
  purpose: 'two-factor-login';
}

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async createSetup(user: { id: string; email: string }): Promise<{
    setupToken: string;
    manualEntryKey: string;
    otpauthUrl: string;
    qrCodeDataUrl: string;
  }> {
    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: TWO_FACTOR_ISSUER,
      label: user.email,
      secret,
      period: 30,
    });

    return {
      setupToken: this.jwtService.sign(
        {
          sub: user.id,
          email: user.email,
          purpose: 'two-factor-setup',
          secret,
        } satisfies TwoFactorSetupTokenPayload,
        { expiresIn: TWO_FACTOR_SETUP_TOKEN_TTL },
      ),
      manualEntryKey: secret,
      otpauthUrl,
      qrCodeDataUrl: await QRCode.toDataURL(otpauthUrl),
    };
  }

  validateSetupToken(token: string): {
    userId: string;
    email: string;
    secret: string;
  } {
    const payload = this.verifyToken<TwoFactorSetupTokenPayload>(
      token,
      'two-factor-setup',
    );

    return {
      userId: payload.sub,
      email: payload.email,
      secret: payload.secret,
    };
  }

  createChallengeToken(userId: string): string {
    return this.jwtService.sign(
      {
        sub: userId,
        purpose: 'two-factor-login',
      } satisfies TwoFactorChallengeTokenPayload,
      { expiresIn: TWO_FACTOR_CHALLENGE_TOKEN_TTL },
    );
  }

  validateChallengeToken(token: string): { userId: string } {
    const payload = this.verifyToken<TwoFactorChallengeTokenPayload>(
      token,
      'two-factor-login',
    );
    return { userId: payload.sub };
  }

  encryptSecret(secret: string): string {
    const encryptedSecret = this.encryptionService.encrypt(secret);
    if (!encryptedSecret) {
      throw new UnauthorizedException(
        'No pudimos configurar la autenticación en dos pasos. Intentá nuevamente.',
      );
    }
    return encryptedSecret;
  }

  decryptSecret(secretEncrypted: string | null | undefined): string | null {
    return this.encryptionService.decrypt(secretEncrypted);
  }

  verifyTotp(code: string, secret: string): boolean {
    return verifySync({
      token: code,
      secret,
      period: 30,
      epochTolerance: 30,
    }).valid;
  }

  generateRecoveryCodes(): string[] {
    return Array.from({ length: RECOVERY_CODES_COUNT }, () =>
      this.formatRecoveryCode(crypto.randomBytes(4).toString('hex')),
    );
  }

  hashRecoveryCodes(codes: string[]): string[] {
    return codes.map((code) => this.hashRecoveryCode(code));
  }

  consumeRecoveryCode(
    recoveryCode: string,
    existingHashes: string[],
  ): {
    matched: boolean;
    remainingHashes: string[];
  } {
    const normalizedInput = this.normalizeRecoveryCode(recoveryCode);
    const inputHash = this.hashNormalizedRecoveryCode(normalizedInput);

    const matchedIndex = existingHashes.findIndex((hash) =>
      this.safeCompare(hash, inputHash),
    );

    if (matchedIndex === -1) {
      return {
        matched: false,
        remainingHashes: existingHashes,
      };
    }

    return {
      matched: true,
      remainingHashes: existingHashes.filter(
        (_, index) => index !== matchedIndex,
      ),
    };
  }

  private verifyToken<T extends { purpose: TokenPurpose }>(
    token: string,
    expectedPurpose: TokenPurpose,
  ): T {
    try {
      const payload = this.jwtService.verify<T>(token);
      if (payload.purpose !== expectedPurpose) {
        throw new UnauthorizedException(
          'El desafío de autenticación expiró. Intentá nuevamente.',
        );
      }
      return payload;
    } catch {
      throw new UnauthorizedException(
        'El desafío de autenticación expiró. Intentá nuevamente.',
      );
    }
  }

  private formatRecoveryCode(rawHex: string): string {
    const normalized = rawHex.toUpperCase();
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`;
  }

  private hashRecoveryCode(code: string): string {
    return this.hashNormalizedRecoveryCode(this.normalizeRecoveryCode(code));
  }

  private hashNormalizedRecoveryCode(normalizedCode: string): string {
    return crypto
      .createHash('sha256')
      .update(normalizedCode, 'utf8')
      .digest('hex');
  }

  private normalizeRecoveryCode(code: string): string {
    return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  }

  private safeCompare(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  }
}

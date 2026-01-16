import { Injectable, UnauthorizedException, ConflictException, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterInput, LoginInput } from './dto/auth.input';
import { UserRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';
import { LoginThrottlerService } from '@/common/guards';
import { ReferralsService } from '../referrals/referrals.service';

// Token expiration times
const ACCESS_TOKEN_EXPIRY = '15m';  // 15 minutes
const REFRESH_TOKEN_EXPIRY_DAYS = 7; // 7 days
const VERIFICATION_CODE_EXPIRY_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private notifications: NotificationsService,
    private activityService: ActivityService,
    private loginThrottler: LoginThrottlerService,
    @Inject(forwardRef(() => ReferralsService))
    private referralsService: ReferralsService,
  ) {}

  async register(input: RegisterInput) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Validate terms acceptance
    if (!input.acceptTerms) {
      throw new ConflictException('Debe aceptar los términos y condiciones');
    }

    // Validate age (must be 18+)
    const birthDate = new Date(input.fechaNacimiento);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      throw new ConflictException('Debe ser mayor de 18 años para registrarse');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        nombre: input.nombre,
        apellido: input.apellido,
        fechaNacimiento: birthDate,
        termsAcceptedAt: new Date(),
        termsVersion: '2026-01',
        role: UserRole.USER,
        emailVerified: false,
        reputation: {
          create: {
            // Default values are set in schema (level: NUEVO, sales: 0)
          },
        },
      },
    });

    // Store referral code for later (after verification)
    if (input.referralCode) {
      // We'll apply it after email verification
      this.logger.log(`Referral code ${input.referralCode} pending for user ${user.id}`);
    }

    // Generate and send verification code
    const verificationCode = this.generateVerificationCode();
    await this.createEmailVerificationCode(user.id, verificationCode);

    // Send verification email (non-blocking)
    this.notifications.sendEmailVerificationCode(user.email, {
      userName: user.nombre,
      code: verificationCode,
      expiresInMinutes: VERIFICATION_CODE_EXPIRY_MINUTES,
    }).catch((err) => {
      this.logger.error(`Failed to send verification email: ${err.message}`);
    });

    // Log activity
    this.activityService.logUserRegistered(user.id, 'email').catch((err) => {
      this.logger.error(`Failed to log registration: ${err.message}`);
    });

    // Return user without tokens - needs verification first
    return {
      user,
      requiresVerification: true,
      message: 'Verificá tu email con el código que te enviamos',
    };
  }

  async verifyEmail(userId: string, code: string, referralCode?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (user.emailVerified) {
      throw new ConflictException('Email ya verificado');
    }

    // Find valid verification code
    const verificationCode = await this.prisma.emailVerificationCode.findFirst({
      where: {
        userId,
        code,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verificationCode) {
      // Increment attempts on any code for this user
      await this.prisma.emailVerificationCode.updateMany({
        where: { userId, isUsed: false },
        data: { attempts: { increment: 1 } },
      });

      // Check if max attempts exceeded
      const latestCode = await this.prisma.emailVerificationCode.findFirst({
        where: { userId, isUsed: false },
        orderBy: { createdAt: 'desc' },
      });

      if (latestCode && latestCode.attempts >= latestCode.maxAttempts) {
        throw new UnauthorizedException('Demasiados intentos. Solicitá un nuevo código.');
      }

      throw new UnauthorizedException('Código inválido o expirado');
    }

    // Mark code as used and verify email
    await this.prisma.$transaction([
      this.prisma.emailVerificationCode.update({
        where: { id: verificationCode.id },
        data: { isUsed: true, usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      }),
    ]);

    // Apply referral code if provided
    let referrerName: string | undefined;
    if (referralCode) {
      try {
        const referrer = await this.prisma.user.findUnique({
          where: { referralCode: referralCode.toUpperCase() },
          select: { nombre: true },
        });
        if (referrer) {
          await this.referralsService.applyReferralCode(userId, referralCode);
          referrerName = referrer.nombre;
        }
      } catch (err) {
        this.logger.warn(`Failed to apply referral code: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Send welcome notifications
    this.sendWelcomeNotifications(user, referrerName).catch((err) => {
      this.logger.error(`Failed to send welcome notifications: ${err.message}`);
    });

    // Generate tokens
    const accessToken = this.generateAccessToken(user.id, user.email, user.role);
    const refreshToken = await this.createRefreshToken(user.id);

    return { token: accessToken, refreshToken, user: { ...user, emailVerified: true } };
  }

  async resendVerificationCode(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (user.emailVerified) {
      throw new ConflictException('Email ya verificado');
    }

    // Check rate limit - max 3 codes per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCodes = await this.prisma.emailVerificationCode.count({
      where: {
        userId,
        createdAt: { gt: oneHourAgo },
      },
    });

    if (recentCodes >= 3) {
      throw new ConflictException('Demasiados intentos. Esperá una hora antes de solicitar otro código.');
    }

    // Invalidate old codes
    await this.prisma.emailVerificationCode.updateMany({
      where: { userId, isUsed: false },
      data: { isUsed: true },
    });

    // Generate new code
    const verificationCode = this.generateVerificationCode();
    await this.createEmailVerificationCode(userId, verificationCode);

    // Send email
    await this.notifications.sendEmailVerificationCode(user.email, {
      userName: user.nombre,
      code: verificationCode,
      expiresInMinutes: VERIFICATION_CODE_EXPIRY_MINUTES,
    });

    return true;
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async createEmailVerificationCode(userId: string, code: string) {
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);

    return this.prisma.emailVerificationCode.create({
      data: {
        userId,
        code,
        expiresAt,
      },
    });
  }

  private async sendWelcomeNotifications(user: { id: string; email: string; nombre: string }, referrerName?: string) {
    const userName = user.nombre || user.email.split('@')[0];

    const emailPromise = referrerName
      ? this.notifications.sendWelcomeWithReferralBonusEmail(user.email, { userName, referrerName })
      : this.notifications.sendWelcomeEmail(user.email, { userName });

    const welcomeMessage = referrerName
      ? `¡Hola ${userName}! Fuiste invitado por ${referrerName}. ¡Explora las rifas disponibles!`
      : `¡Hola ${userName}! Tu cuenta ha sido creada exitosamente. ¡Explora las rifas disponibles!`;

    await Promise.all([
      emailPromise,
      this.notifications.create(
        user.id,
        'WELCOME',
        '¡Bienvenido!',
        welcomeMessage,
      ),
      this.activityService.logUserRegistered(user.id, 'email'),
    ]);
  }

  async login(input: LoginInput, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    // Helper to record failed attempt and throw
    const recordFailedAttempt = (message: string): never => {
      if (ip) {
        const result = this.loginThrottler.recordFailedAttempt(ip);
        if (result.blocked) {
          throw new UnauthorizedException(
            'Demasiados intentos fallidos. Su IP ha sido bloqueada temporalmente.',
          );
        }
      }
      throw new UnauthorizedException(message);
    };

    if (!user) {
      return recordFailedAttempt('Invalid credentials');
    }

    // Check if user is deleted
    if (user.isDeleted) {
      return recordFailedAttempt('Account has been deleted');
    }

    // Check if user is banned
    if (user.role === UserRole.BANNED) {
      return recordFailedAttempt('Account has been banned');
    }

    // OAuth users don't have passwords
    if (!user.passwordHash) {
      return recordFailedAttempt('Please login with Google');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

    if (!isPasswordValid) {
      return recordFailedAttempt('Invalid credentials');
    }

    // Successful login - clear failed attempts
    if (ip) {
      this.loginThrottler.clearAttempts(ip);
    }

    const accessToken = this.generateAccessToken(user.id, user.email, user.role);
    const refreshToken = await this.createRefreshToken(user.id, undefined, ip);

    // Log login activity (non-blocking)
    this.activityService.logUserLoggedIn(user.id).catch((err) => {
      this.logger.error(`Failed to log login activity: ${err.message}`);
    });

    return { token: accessToken, refreshToken, user };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.isDeleted || user.role === UserRole.BANNED) {
      return null;
    }

    return user;
  }

  /**
   * Generate JWT token for a user (used by OAuth flows)
   */
  async generateTokenForUser(user: { id: string; email: string; role: UserRole }): Promise<{ token: string; refreshToken: string }> {
    const token = this.generateAccessToken(user.id, user.email, user.role);
    const refreshToken = await this.createRefreshToken(user.id);
    return { token, refreshToken };
  }

  /**
   * Refresh the access token using a refresh token.
   * Implements token rotation - old refresh token is revoked and a new one is issued.
   */
  async refreshAccessToken(refreshTokenValue: string): Promise<{ token: string; refreshToken: string }> {
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshTokenValue },
      include: { user: true },
    });

    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (refreshToken.revokedAt) {
      // Token was already used - possible token theft, revoke all user tokens
      this.logger.warn(`Refresh token reuse detected for user ${refreshToken.userId}`);
      await this.revokeAllUserRefreshTokens(refreshToken.userId);
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (refreshToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = refreshToken.user;

    if (!user || user.isDeleted || user.role === UserRole.BANNED) {
      throw new UnauthorizedException('User account is not active');
    }

    // Revoke the old refresh token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: refreshToken.id },
      data: { revokedAt: new Date() },
    });

    // Generate new tokens
    const newAccessToken = this.generateAccessToken(user.id, user.email, user.role);
    const newRefreshToken = await this.createRefreshToken(user.id);

    return { token: newAccessToken, refreshToken: newRefreshToken };
  }

  /**
   * Revoke a specific refresh token (logout)
   */
  async revokeRefreshToken(refreshTokenValue: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        token: refreshTokenValue,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke all refresh tokens for a user (logout all devices)
   */
  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Create a new refresh token for a user
   */
  private async createRefreshToken(userId: string, deviceInfo?: string, ipAddress?: string): Promise<string> {
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
        deviceInfo,
        ipAddress,
      },
    });

    return token;
  }

  /**
   * Clean up expired refresh tokens (called periodically)
   */
  async cleanupExpiredRefreshTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { not: null } },
        ],
      },
    });
    return result.count;
  }

  private generateAccessToken(userId: string, email: string, role: UserRole): string {
    return this.jwtService.sign(
      {
        sub: userId,
        email,
        role,
      },
      { expiresIn: ACCESS_TOKEN_EXPIRY },
    );
  }
}

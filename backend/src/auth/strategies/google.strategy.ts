import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { User } from '@prisma/client';

@Injectable()
export class GoogleStrategy
  extends PassportStrategy(Strategy, 'google')
  implements OnModuleInit
{
  private readonly logger = new Logger(GoogleStrategy.name);
  private isConfigured = false;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL');
    const normalizedClientID = clientID?.trim() || undefined;
    const normalizedClientSecret = clientSecret?.trim() || undefined;
    const normalizedCallbackURL = callbackURL?.trim() || undefined;

    // Pass placeholder values if not configured (strategy won't work but app won't crash)
    super({
      clientID: normalizedClientID ?? 'not-configured',
      clientSecret: normalizedClientSecret ?? 'not-configured',
      callbackURL:
        normalizedCallbackURL ?? 'http://localhost:3001/auth/google/callback',
      scope: ['email', 'profile'],
    });

    this.isConfigured = !!(normalizedClientID && normalizedClientSecret);
  }

  onModuleInit() {
    if (this.isConfigured) {
      this.logger.log('✅ Google OAuth configured');
    } else {
      this.logger.warn(
        '⚠️ Google OAuth NOT configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)',
      );
    }
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    if (!this.isConfigured) {
      return done(new Error('Google OAuth is not configured'), undefined);
    }

    const { emails, displayName, photos, id: googleId } = profile;
    const email = emails?.[0]?.value?.toLowerCase();

    if (!email) {
      return done(new Error('No email found in Google profile'), undefined);
    }

    try {
      // Check if user exists by Google ID first
      let user: User | null = await this.prisma.user.findFirst({
        where: { googleId },
      });

      if (user) {
        this.logger.log(`User ${email} logged in via Google`);
        return done(null, user);
      }

      // Check if user exists by email
      user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        // Link Google account to existing user
        user = await this.prisma.user.update({
          where: { email },
          data: {
            googleId,
            avatarUrl: photos?.[0]?.value || user.avatarUrl,
          },
        });
        this.logger.log(`Linked Google account to existing user: ${email}`);
        return done(null, user);
      }

      // Create new user
      const nameParts = displayName?.split(' ') || ['Usuario'];
      const nombre = nameParts[0] || 'Usuario';
      const apellido = nameParts.slice(1).join(' ') || 'Google';

      user = await this.prisma.user.create({
        data: {
          email,
          googleId,
          nombre,
          apellido,
          avatarUrl: photos?.[0]?.value,
          termsAcceptedAt: new Date(),
        },
      });

      this.logger.log(`Created new user via Google: ${email}`);

      // Send welcome email
      await this.notificationsService.sendWelcomeEmail(email, {
        userName: nombre,
      });

      return done(null, user);
    } catch (error) {
      this.logger.error(`Google OAuth error: ${(error as Error).message}`);
      return done(error as Error, undefined);
    }
  }
}

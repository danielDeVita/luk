import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { AuthGoogleController } from './auth-google.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GqlAuthGuard } from './guards/gql-auth.guard';
import { LoginThrottlerService, LoginThrottlerGuard } from '@/common/guards';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { SocialPromotionsModule } from '../social-promotions/social-promotions.module';
import { TurnstileService } from './turnstile.service';
import { TwoFactorService } from './two-factor.service';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    UsersModule,
    SocialPromotionsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthGoogleController],
  providers: [
    AuthService,
    AuthResolver,
    JwtStrategy,
    GoogleStrategy,
    GqlAuthGuard,
    LoginThrottlerService,
    LoginThrottlerGuard,
    TurnstileService,
    TwoFactorService,
  ],
  exports: [AuthService, JwtModule, GqlAuthGuard, LoginThrottlerService],
})
export class AuthModule {}

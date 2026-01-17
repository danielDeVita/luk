import { Resolver, Mutation, Args, Query, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthPayload, RegisterPayload } from './dto/auth-payload';
import { RegisterInput, LoginInput } from './dto/auth.input';
import { User } from '../users/entities/user.entity';
import { GqlAuthGuard } from './guards/gql-auth.guard';
import { LoginThrottlerGuard } from '@/common/guards';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';

// Cookie configuration constants
const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

@Resolver()
export class AuthResolver {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  private setAuthCookies(
    res: Response,
    token: string,
    refreshToken: string,
  ): void {
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    // Set access token as httpOnly cookie
    // In development, use sameSite: 'none' to allow cross-origin requests (localhost:3000 → localhost:3001)
    // Note: sameSite: 'none' requires secure: true (always, not just production)
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: isProduction ? 'strict' : 'none',
      maxAge: ACCESS_TOKEN_MAX_AGE,
      path: '/',
    });

    // Set refresh token as httpOnly cookie
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: isProduction ? 'strict' : 'none',
      maxAge: REFRESH_TOKEN_MAX_AGE,
      path: '/auth',
    });
  }

  @Public()
  @Mutation(() => RegisterPayload)
  async register(
    @Args('input') input: RegisterInput,
  ): Promise<RegisterPayload> {
    const result = await this.authService.register(input);
    // No cookies set - user must verify email first
    return result;
  }

  @Public()
  @Mutation(() => AuthPayload)
  async verifyEmail(
    @Args('userId') userId: string,
    @Args('code') code: string,
    @Context() context: { req: Record<string, unknown>; res: Response },
    @Args('referralCode', { type: () => String, nullable: true })
    referralCode?: string,
  ): Promise<AuthPayload> {
    const result = await this.authService.verifyEmail(
      userId,
      code,
      referralCode,
    );

    // Set httpOnly cookies for the tokens
    this.setAuthCookies(context.res, result.token, result.refreshToken);

    return result;
  }

  @Public()
  @Mutation(() => Boolean)
  async resendVerificationCode(
    @Args('userId') userId: string,
  ): Promise<boolean> {
    return this.authService.resendVerificationCode(userId);
  }

  @Public()
  @UseGuards(LoginThrottlerGuard)
  @Mutation(() => AuthPayload)
  async login(
    @Args('input') input: LoginInput,
    @Context() context: { req: Record<string, unknown>; res: Response },
  ): Promise<AuthPayload> {
    const ip = this.extractIp(context.req);
    const result = await this.authService.login(input, ip);

    // Set httpOnly cookies for the tokens
    this.setAuthCookies(context.res, result.token, result.refreshToken);

    // Return user info (tokens are now in cookies, not response body)
    return result;
  }

  private extractIp(req: Record<string, unknown>): string {
    const headers = req.headers as
      | Record<string, string | string[]>
      | undefined;
    const forwardedFor = headers?.['x-forwarded-for'];
    if (forwardedFor) {
      const clientIp = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0];
      return clientIp.trim();
    }
    const realIp = headers?.['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }
    return (req.ip as string) || 'unknown';
  }

  @Query(() => User)
  @UseGuards(GqlAuthGuard)
  async me(@CurrentUser() user: User): Promise<User> {
    return user;
  }
}

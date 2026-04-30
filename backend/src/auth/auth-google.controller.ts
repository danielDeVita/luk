import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { User } from '@prisma/client';

interface RequestWithUser extends Request {
  user?: User;
}

interface RequestWithCookies extends Request {
  cookies: Record<string, string | undefined>;
}

const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthGoogleController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  private getCookieSettings(): {
    secure: boolean;
    sameSite: 'none' | 'lax';
  } {
    const secureCookiesEnabled =
      this.configService.get<string>('SECURE_COOKIES') === 'true' ||
      (this.configService.get('NODE_ENV') === 'production' &&
        process.env.CI !== 'true');

    return {
      secure: secureCookiesEnabled,
      sameSite: secureCookiesEnabled ? 'none' : 'lax',
    };
  }

  /**
   * GET /auth/google
   * Redirects to Google OAuth consent screen
   */
  @Get('google')
  @Public()
  @UseGuards(AuthGuard('google'))
  googleAuth(): void {
    // Guard redirects to Google
  }

  /**
   * GET /auth/google/callback
   * Handles the Google OAuth callback
   * Sets access token and refresh token as cookies
   */
  @Get('google/callback')
  @Public()
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl: string =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const cookieSettings = this.getCookieSettings();

    if (!req.user) {
      return res.redirect(`${frontendUrl}/auth/login?error=google_auth_failed`);
    }

    // Generate JWT access token and refresh token
    const { token, refreshToken } = await this.authService.generateTokenForUser(
      req.user,
      'google',
      req.ip,
    );

    // Complete the OAuth flow with cookies plus a one-time access-token exchange.
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: cookieSettings.secure,
      sameSite: cookieSettings.sameSite,
      maxAge: ACCESS_TOKEN_MAX_AGE,
      path: '/',
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: cookieSettings.secure,
      sameSite: cookieSettings.sameSite,
      maxAge: REFRESH_TOKEN_MAX_AGE,
      path: '/auth',
    });

    return res.redirect(`${frontendUrl}/auth/callback?success=true`);
  }

  /**
   * GET /auth/token
   * Returns the current token from cookie (for frontend to read after OAuth)
   */
  @Get('token')
  @Public()
  getTokenFromCookie(
    @Req() req: RequestWithCookies,
    @Res() res: Response,
  ): Response {
    const token: string | undefined = req.cookies.auth_token;

    if (!token) {
      return res.status(401).json({ error: 'No token found' });
    }

    // Clear the httpOnly cookie after reading (frontend will store in memory/context)
    res.clearCookie('auth_token');
    // Note: refresh_token stays in cookies for auto-refresh

    return res.json({ token } as { token: string });
  }

  /**
   * GET /auth/refresh
   * Refreshes the access token using the refresh-token cookie.
   */
  @Get('refresh')
  @Public()
  async refreshToken(
    @Req() req: RequestWithCookies,
    @Res() res: Response,
  ): Promise<Response> {
    const refreshTokenValue: string | undefined = req.cookies.refresh_token;
    const cookieSettings = this.getCookieSettings();

    if (!refreshTokenValue) {
      return res.status(401).json({ error: 'No refresh token found' });
    }

    try {
      const { token, refreshToken } =
        await this.authService.refreshAccessToken(refreshTokenValue);

      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: cookieSettings.secure,
        sameSite: cookieSettings.sameSite,
        maxAge: ACCESS_TOKEN_MAX_AGE,
        path: '/',
      });

      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: cookieSettings.secure,
        sameSite: cookieSettings.sameSite,
        maxAge: REFRESH_TOKEN_MAX_AGE,
        path: '/auth',
      });

      return res.json({ token });
    } catch {
      // Clear invalid cookies
      res.clearCookie('auth_token');
      res.clearCookie('refresh_token', { path: '/auth' });
      return res
        .status(401)
        .json({ error: 'Invalid or expired refresh token' });
    }
  }

  /**
   * POST /auth/logout
   * Revokes refresh token and clears auth cookies
   */
  @Get('logout')
  @Public()
  async logout(
    @Req() req: RequestWithCookies,
    @Res() res: Response,
  ): Promise<Response> {
    const refreshTokenValue: string | undefined = req.cookies.refresh_token;

    // Revoke the refresh token if it exists
    if (refreshTokenValue) {
      await this.authService.revokeRefreshToken(refreshTokenValue).catch(() => {
        // Ignore errors - token might already be invalid
      });
    }

    res.clearCookie('auth_token');
    res.clearCookie('refresh_token', { path: '/auth' });
    return res.json({ success: true });
  }
}

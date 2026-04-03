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

@Controller('auth')
export class AuthGoogleController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

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
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    if (!req.user) {
      return res.redirect(`${frontendUrl}/auth/login?error=google_auth_failed`);
    }

    // Generate JWT access token and refresh token
    const { token, refreshToken } = await this.authService.generateTokenForUser(
      req.user,
      'google',
      req.ip,
    );

    // Pass token in URL for cross-subdomain deployments (third-party cookies blocked)
    // Token is short-lived (15 min) and immediately stored in localStorage by frontend
    // Also set cookies as fallback for same-domain deployments
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: isProduction ? 'strict' : 'none',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: isProduction ? 'strict' : 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/auth',
    });

    // Redirect with tokens in URL (for cross-subdomain where cookies are blocked)
    return res.redirect(
      `${frontendUrl}/auth/callback?success=true&token=${token}&refreshToken=${refreshToken}`,
    );
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
   * Refreshes the access token using the refresh token from:
   * 1. Authorization header (Bearer token) - for cross-subdomain deployments
   * 2. httpOnly cookie - for same-domain deployments
   */
  @Get('refresh')
  @Public()
  async refreshToken(
    @Req() req: RequestWithCookies,
    @Res() res: Response,
  ): Promise<Response> {
    // Try to get refresh token from Authorization header first (cross-subdomain support)
    const authHeader: string | undefined = req.headers.authorization;
    const headerToken: string | null =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : null;

    // Fall back to cookie if no header token
    const refreshTokenValue: string | null | undefined =
      headerToken || req.cookies.refresh_token;
    const isProduction: boolean =
      this.configService.get<string>('NODE_ENV') === 'production';

    if (!refreshTokenValue) {
      return res.status(401).json({ error: 'No refresh token found' });
    }

    try {
      const { token, refreshToken } =
        await this.authService.refreshAccessToken(refreshTokenValue);

      // Set new access token as httpOnly cookie
      // In development, use sameSite: 'none' to allow cross-origin requests (localhost:3000 → localhost:3001)
      // Note: sameSite: 'none' requires secure: true (always, not just production)
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: true,
        sameSite: isProduction ? 'strict' : 'none',
        maxAge: 15 * 60 * 1000, // 15 minutes
        path: '/',
      });

      // Set new refresh token (rotation)
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: isProduction ? 'strict' : 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/auth',
      });

      // Return both tokens in response (for cross-subdomain where cookies don't work)
      return res.json({ token, refreshToken });
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

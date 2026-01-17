import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';

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
  async googleAuth() {
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
  async googleAuthCallback(@Req() req: any, @Res() res: Response) {
    const frontendUrl =
      this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    if (!req.user) {
      return res.redirect(`${frontendUrl}/auth/login?error=google_auth_failed`);
    }

    // Generate JWT access token and refresh token
    const { token, refreshToken } = await this.authService.generateTokenForUser(
      req.user,
    );

    // Set access token as httpOnly cookie (short-lived, 15 min)
    // In development, use sameSite: 'none' to allow cross-origin requests (localhost:3000 → localhost:3001)
    // Note: sameSite: 'none' requires secure: true (always, not just production)
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: isProduction ? 'strict' : 'none',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });

    // Set refresh token as httpOnly cookie (long-lived, 7 days)
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: isProduction ? 'strict' : 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/auth', // Only sent to /auth endpoints
    });

    // Redirect to frontend callback (tokens are in cookies, not URL)
    return res.redirect(`${frontendUrl}/auth/callback?success=true`);
  }

  /**
   * GET /auth/token
   * Returns the current token from cookie (for frontend to read after OAuth)
   */
  @Get('token')
  @Public()
  async getTokenFromCookie(@Req() req: any, @Res() res: Response) {
    const token = req.cookies?.auth_token;

    if (!token) {
      return res.status(401).json({ error: 'No token found' });
    }

    // Clear the httpOnly cookie after reading (frontend will store in memory/context)
    res.clearCookie('auth_token');
    // Note: refresh_token stays in cookies for auto-refresh

    return res.json({ token });
  }

  /**
   * POST /auth/refresh
   * Refreshes the access token using the refresh token from httpOnly cookie
   */
  @Get('refresh')
  @Public()
  async refreshToken(@Req() req: any, @Res() res: Response) {
    const refreshTokenValue = req.cookies?.refresh_token;
    const isProduction = this.configService.get('NODE_ENV') === 'production';

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
  async logout(@Req() req: any, @Res() res: Response) {
    const refreshTokenValue = req.cookies?.refresh_token;

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

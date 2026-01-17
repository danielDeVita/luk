import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  Req,
  Logger,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { MpConnectService } from './mp-connect.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Controller('mp/connect')
export class MpConnectController {
  private readonly logger = new Logger(MpConnectController.name);

  constructor(
    private readonly mpConnectService: MpConnectService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Start MP OAuth flow - redirects user to Mercado Pago authorization page.
   * Accepts token via query param (for cross-subdomain where cookies are blocked)
   * or via Authorization header/cookie (standard auth).
   */
  @Get()
  @Public() // Public because we handle auth manually to support query param token
  async startConnect(
    @Query('token') tokenParam: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    try {
      // Try to get user from: 1) query param token, 2) cookie, 3) header
      let userId: string | null = null;

      // 1. Try query param token (for cross-subdomain deployments)
      if (tokenParam) {
        try {
          const payload = this.jwtService.verify(tokenParam);
          userId = payload.sub;
        } catch {
          this.logger.warn('Invalid token in query param');
        }
      }

      // 2. Try cookie
      if (!userId && req.cookies?.auth_token) {
        try {
          const payload = this.jwtService.verify(req.cookies.auth_token);
          userId = payload.sub;
        } catch {
          this.logger.warn('Invalid token in cookie');
        }
      }

      // 3. Try Authorization header
      if (!userId) {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
          try {
            const token = authHeader.substring(7);
            const payload = this.jwtService.verify(token);
            userId = payload.sub;
          } catch {
            this.logger.warn('Invalid token in header');
          }
        }
      }

      if (!userId) {
        throw new UnauthorizedException('No valid authentication found');
      }

      const { authUrl } = this.mpConnectService.generateAuthUrl(userId);
      this.logger.log(`Redirecting user ${userId} to MP auth`);
      return res.redirect(authUrl);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`Failed to start MP connect: ${message}`);

      return res.redirect(
        `${frontendUrl}/dashboard/settings?mp_error=${encodeURIComponent(message)}`,
      );
    }
  }

  /**
   * MP OAuth callback - receives authorization code and exchanges for tokens.
   * This endpoint is public because MP redirects here directly.
   */
  @Get('callback')
  @Public()
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Res() res: Response,
  ) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const profileUrl = `${frontendUrl}/dashboard/settings`;

    // Handle MP errors
    if (error) {
      this.logger.error(`MP OAuth error: ${error} - ${errorDescription}`);
      return res.redirect(
        `${profileUrl}?mp_error=${encodeURIComponent(errorDescription || error)}`,
      );
    }

    // Validate required params
    if (!code || !state) {
      this.logger.error('Missing code or state in MP callback');
      return res.redirect(
        `${profileUrl}?mp_error=${encodeURIComponent('Parámetros faltantes')}`,
      );
    }

    try {
      const result = await this.mpConnectService.exchangeCodeForTokens(
        code,
        state,
      );

      this.logger.log(
        `Successfully connected MP account ${result.mpUserId} for user ${result.userId}`,
      );

      return res.redirect(`${profileUrl}?mp_connected=true`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Error al conectar con Mercado Pago';
      this.logger.error(`MP callback error: ${message}`);
      return res.redirect(
        `${profileUrl}?mp_error=${encodeURIComponent(message)}`,
      );
    }
  }

  /**
   * Get current user's MP connection status.
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@CurrentUser() user: { userId: string }) {
    return this.mpConnectService.getConnectionStatus(user.userId);
  }

  /**
   * Disconnect MP account from user.
   */
  @Post('disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnect(
    @CurrentUser() user: { userId: string },
    @Res() res: Response,
  ) {
    try {
      await this.mpConnectService.disconnect(user.userId);
      return res.status(HttpStatus.OK).json({ disconnected: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: message });
    }
  }
}

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
} from '@nestjs/common';
import { Response, Request } from 'express';
import { MpConnectService } from './mp-connect.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ConfigService } from '@nestjs/config';

@Controller('mp/connect')
export class MpConnectController {
  private readonly logger = new Logger(MpConnectController.name);

  constructor(
    private readonly mpConnectService: MpConnectService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Start MP OAuth flow - redirects user to Mercado Pago authorization page.
   * User must be authenticated.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async startConnect(
    @CurrentUser() user: { userId: string },
    @Res() res: Response,
  ) {
    try {
      const { authUrl } = this.mpConnectService.generateAuthUrl(user.userId);
      this.logger.log(`Redirecting user ${user.userId} to MP auth`);
      return res.redirect(authUrl);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`Failed to start MP connect: ${message}`);

      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:3000';
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

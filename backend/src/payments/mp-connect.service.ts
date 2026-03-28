import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import { randomBytes, createHash } from 'crypto';
import { ActivityService } from '../activity/activity.service';
import { captureException } from '../sentry';

interface MpTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
  public_key: string;
}

interface MpErrorResponse {
  message?: string;
}

/**
 * Manages Mercado Pago Connect OAuth, token storage, and refresh for seller accounts.
 */
@Injectable()
export class MpConnectService implements OnModuleDestroy {
  private readonly logger = new Logger(MpConnectService.name);
  private readonly cleanupInterval: NodeJS.Timeout;

  // Store PKCE verifiers temporarily (in production, use Redis)
  private readonly pkceVerifiers = new Map<
    string,
    { verifier: string; userId: string; expiresAt: number }
  >();

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private activityService: ActivityService,
  ) {
    // Clean up expired verifiers every 5 minutes
    this.cleanupInterval = setInterval(
      () => this.cleanupExpiredVerifiers(),
      5 * 60 * 1000,
    );
    this.cleanupInterval.unref();
  }

  /**
   * Stops the background PKCE cleanup interval when the module is destroyed.
   */
  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }

  /**
   * Builds the Mercado Pago OAuth authorization URL and stores the PKCE verifier for the callback.
   */
  generateAuthUrl(userId: string): { authUrl: string; state: string } {
    const clientId = this.configService.get<string>('MP_CLIENT_ID');
    const redirectUri = this.getRedirectUri();

    if (!clientId) {
      throw new BadRequestException('MP_CLIENT_ID no está configurado');
    }

    // Generate PKCE code verifier and challenge
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);

    // Generate state for CSRF protection (also used to retrieve verifier)
    const state = randomBytes(32).toString('hex');

    // Store verifier with 10 minute expiry
    this.pkceVerifiers.set(state, {
      verifier: codeVerifier,
      userId,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      platform_id: 'mp', // Required for marketplace
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `https://auth.mercadopago.com/authorization?${params.toString()}`;

    this.logger.log(`Generated MP auth URL for user ${userId}`);

    return { authUrl, state };
  }

  /**
   * Exchanges an OAuth code for seller tokens and persists the encrypted credentials.
   */
  async exchangeCodeForTokens(
    code: string,
    state: string,
  ): Promise<{
    userId: string;
    mpUserId: string;
  }> {
    const clientId = this.configService.get<string>('MP_CLIENT_ID');
    const clientSecret = this.configService.get<string>('MP_CLIENT_SECRET');
    const redirectUri = this.getRedirectUri();

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'MP_CLIENT_ID o MP_CLIENT_SECRET no están configurados',
      );
    }

    // Retrieve and validate PKCE verifier
    const pkceData = this.pkceVerifiers.get(state);
    if (!pkceData) {
      throw new BadRequestException(
        'Estado inválido o expirado. Intenta conectar nuevamente.',
      );
    }

    if (pkceData.expiresAt < Date.now()) {
      this.pkceVerifiers.delete(state);
      throw new BadRequestException(
        'La sesión expiró. Intenta conectar nuevamente.',
      );
    }

    const { verifier, userId } = pkceData;
    this.pkceVerifiers.delete(state); // One-time use

    // Exchange code for tokens
    const tokenUrl = 'https://api.mercadopago.com/oauth/token';
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = (await response
        .json()
        .catch(() => ({}))) as MpErrorResponse;
      this.logger.error(`MP token exchange failed: ${JSON.stringify(error)}`);
      captureException(
        new Error(error.message || 'Mercado Pago OAuth token exchange failed'),
        {
          user: { id: userId },
          tags: {
            service: 'luk-backend',
            domain: 'payments',
            stage: 'oauth',
          },
          extra: {
            userId,
            state,
          },
        },
      );
      throw new BadRequestException(
        error.message ||
          'Error al conectar con Mercado Pago. Intenta nuevamente.',
      );
    }

    const tokens = (await response.json()) as MpTokenResponse;

    // Update user with MP credentials (encrypt sensitive tokens)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mpUserId: String(tokens.user_id),
        mpAccessToken: this.encryption.encrypt(tokens.access_token),
        mpRefreshToken: this.encryption.encrypt(tokens.refresh_token),
        mpConnectStatus: 'CONNECTED',
      },
    });

    this.logger.log(`User ${userId} connected MP account ${tokens.user_id}`);
    await this.activityService.logMpConnectConnected(
      userId,
      String(tokens.user_id),
    );

    return {
      userId,
      mpUserId: String(tokens.user_id),
    };
  }

  /**
   * Refreshes a seller's Mercado Pago access token using the stored refresh token.
   */
  async refreshAccessToken(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mpRefreshToken: true },
    });

    if (!user?.mpRefreshToken) {
      this.logger.warn(`User ${userId} has no refresh token`);
      return false;
    }

    // Decrypt the stored refresh token
    const decryptedRefreshToken = this.encryption.decrypt(user.mpRefreshToken);
    if (!decryptedRefreshToken) {
      this.logger.error(`Failed to decrypt refresh token for user ${userId}`);
      captureException(new Error('Failed to decrypt MP refresh token'), {
        user: { id: userId },
        tags: {
          service: 'luk-backend',
          domain: 'payments',
          stage: 'oauth',
        },
        extra: {
          userId,
        },
      });
      return false;
    }

    const clientId = this.configService.get<string>('MP_CLIENT_ID');
    const clientSecret = this.configService.get<string>('MP_CLIENT_SECRET');

    const body = new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      grant_type: 'refresh_token',
      refresh_token: decryptedRefreshToken,
    });

    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      this.logger.error(`Failed to refresh token for user ${userId}`);
      captureException(new Error('Mercado Pago token refresh failed'), {
        user: { id: userId },
        tags: {
          service: 'luk-backend',
          domain: 'payments',
          stage: 'oauth',
        },
        extra: {
          userId,
        },
      });
      // Mark as disconnected if refresh fails
      await this.prisma.user.update({
        where: { id: userId },
        data: { mpConnectStatus: 'NOT_CONNECTED' },
      });
      await this.activityService.logMpConnectDisconnected(userId, {
        reason: 'refresh_failed',
      });
      return false;
    }

    const tokens = (await response.json()) as MpTokenResponse;

    // Encrypt new tokens before storing
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mpAccessToken: this.encryption.encrypt(tokens.access_token),
        mpRefreshToken: this.encryption.encrypt(tokens.refresh_token),
      },
    });

    this.logger.log(`Refreshed MP token for user ${userId}`);
    return true;
  }

  /**
   * Removes the stored Mercado Pago connection from a seller account.
   */
  async disconnect(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mpUserId: null,
        mpAccessToken: null,
        mpRefreshToken: null,
        mpConnectStatus: 'NOT_CONNECTED',
      },
    });

    this.logger.log(`User ${userId} disconnected MP account`);
    await this.activityService.logMpConnectDisconnected(userId);
  }

  /**
   * Returns whether the user currently has a connected Mercado Pago account.
   */
  async getConnectionStatus(userId: string): Promise<{
    connected: boolean;
    mpUserId: string | null;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mpConnectStatus: true, mpUserId: true },
    });

    return {
      connected: user?.mpConnectStatus === 'CONNECTED',
      mpUserId: user?.mpUserId ?? null,
    };
  }

  // ==================== PKCE Helpers ====================

  private generateCodeVerifier(): string {
    // 43-128 characters, URL-safe
    return randomBytes(32).toString('base64url');
  }

  private generateCodeChallenge(verifier: string): string {
    // SHA256 hash, base64url encoded
    return createHash('sha256').update(verifier).digest('base64url');
  }

  private getRedirectUri(): string {
    const backendUrl =
      this.configService.get<string>('BACKEND_URL') || 'http://localhost:3001';
    return `${backendUrl.replace(/\/$/, '')}/mp/connect/callback`;
  }

  private cleanupExpiredVerifiers(): void {
    const now = Date.now();
    for (const [state, data] of this.pkceVerifiers.entries()) {
      if (data.expiresAt < now) {
        this.pkceVerifiers.delete(state);
      }
    }
  }
}

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface MercadoPagoOAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  user_id?: number | string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  public_key?: string;
}

interface MercadoPagoUserResponse {
  id?: number | string;
  email?: string;
  nickname?: string;
  first_name?: string;
  last_name?: string;
  site_id?: string;
}

interface MercadoPagoPayoutTransactionResponse {
  id?: number | string;
  status?: string;
  status_detail?: string;
}

interface MercadoPagoPayoutResponse {
  id?: number | string;
  status?: string;
  status_detail?: string;
  message?: string;
  error?: string;
  transactions?: MercadoPagoPayoutTransactionResponse[];
}

interface MercadoPagoErrorPayload {
  message?: string;
  error?: string;
}

export interface MercadoPagoConnectedSellerAccount {
  providerAccountId: string;
  providerEmail: string | null;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  metadata: {
    scope?: string;
    tokenType?: string;
    publicKey?: string;
    nickname?: string;
    siteId?: string;
    firstName?: string;
    lastName?: string;
  };
}

export interface CreateMercadoPagoSellerPayoutInput {
  payoutId: string;
  sellerProviderAccountId: string;
  sellerProviderEmail?: string | null;
  amount: number;
  description: string;
}

export interface MercadoPagoSellerPayoutResult {
  providerPayoutId: string;
  providerStatus: 'processing' | 'completed' | 'failed';
  providerStatusDetail: string | null;
  metadata: {
    payoutId?: string;
    transactionId?: string;
    sellerProviderAccountId?: string;
    sellerProviderEmail?: string | null;
  };
}

@Injectable()
export class MercadoPagoSellerProvider {
  private readonly logger = new Logger(MercadoPagoSellerProvider.name);
  private readonly tokenEndpoint = 'https://api.mercadopago.com/oauth/token';
  private readonly userEndpoint = 'https://api.mercadopago.com/users/me';
  private readonly payoutEndpoint = 'https://api.mercadopago.com/v1/payouts';

  constructor(private readonly configService: ConfigService) {}

  isOAuthConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.oauthRedirectUri);
  }

  isPayoutsEnabled(): boolean {
    return this.configService.get<boolean>('MP_PAYOUTS_ENABLED') === true;
  }

  isPayoutsConfigured(): boolean {
    return this.isPayoutsEnabled() && Boolean(this.platformAccessToken);
  }

  buildAuthorizationUrl(state: string): string {
    if (!this.isOAuthConfigured()) {
      throw new BadRequestException(
        'Mercado Pago OAuth no está configurado para conectar vendedores',
      );
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      platform_id: 'mp',
      state,
      redirect_uri: this.oauthRedirectUri,
    });

    return `https://auth.mercadopago.com.ar/authorization?${params.toString()}`;
  }

  async completeOAuth(
    code: string,
  ): Promise<MercadoPagoConnectedSellerAccount> {
    if (!this.isOAuthConfigured()) {
      throw new BadRequestException(
        'Mercado Pago OAuth no está configurado para conectar vendedores',
      );
    }

    const tokenResponse = await this.exchangeAuthorizationCode(code);
    if (!tokenResponse.access_token || tokenResponse.user_id === undefined) {
      throw new BadRequestException(
        'Mercado Pago no devolvió una conexión de vendedor válida',
      );
    }

    const profile = await this.getConnectedUserProfile(
      tokenResponse.access_token,
    );
    const providerAccountId = String(profile.id ?? tokenResponse.user_id);
    const expiresIn =
      typeof tokenResponse.expires_in === 'number'
        ? tokenResponse.expires_in
        : null;

    return {
      providerAccountId,
      providerEmail: profile.email ?? null,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token ?? null,
      tokenExpiresAt:
        expiresIn === null ? null : new Date(Date.now() + expiresIn * 1000),
      metadata: {
        scope: tokenResponse.scope,
        tokenType: tokenResponse.token_type,
        publicKey: tokenResponse.public_key,
        nickname: profile.nickname,
        siteId: profile.site_id,
        firstName: profile.first_name,
        lastName: profile.last_name,
      },
    };
  }

  async createSellerPayout(
    input: CreateMercadoPagoSellerPayoutInput,
  ): Promise<MercadoPagoSellerPayoutResult> {
    if (!this.isPayoutsConfigured()) {
      throw new BadRequestException(
        'Las liquidaciones Mercado Pago no están habilitadas o falta MP_ACCESS_TOKEN',
      );
    }

    const roundedAmount = Math.round(input.amount * 100) / 100;
    const body = {
      external_reference: input.payoutId,
      description: input.description,
      transactions: [
        {
          amount: roundedAmount,
          receiver_id: input.sellerProviderAccountId,
        },
      ],
    };

    const response = await fetch(this.payoutEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.platformAccessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': input.payoutId,
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => ({}))) as
      | MercadoPagoPayoutResponse
      | MercadoPagoErrorPayload;

    if (!response.ok) {
      const errorPayload = payload as MercadoPagoErrorPayload;
      throw new Error(
        errorPayload.message ||
          errorPayload.error ||
          `Mercado Pago payout failed with ${response.status}`,
      );
    }

    return this.normalizePayoutResult(payload as MercadoPagoPayoutResponse, {
      sellerProviderAccountId: input.sellerProviderAccountId,
      sellerProviderEmail: input.sellerProviderEmail,
    });
  }

  async getSellerPayoutStatus(
    providerPayoutId: string,
  ): Promise<MercadoPagoSellerPayoutResult> {
    if (!this.isPayoutsConfigured()) {
      throw new BadRequestException(
        'Las liquidaciones Mercado Pago no están habilitadas o falta MP_ACCESS_TOKEN',
      );
    }

    const response = await fetch(`${this.payoutEndpoint}/${providerPayoutId}`, {
      headers: {
        Authorization: `Bearer ${this.platformAccessToken}`,
      },
    });

    const payload = (await response.json().catch(() => ({}))) as
      | MercadoPagoPayoutResponse
      | MercadoPagoErrorPayload;

    if (!response.ok) {
      const errorPayload = payload as MercadoPagoErrorPayload;
      throw new Error(
        errorPayload.message ||
          errorPayload.error ||
          `Mercado Pago payout status failed with ${response.status}`,
      );
    }

    return this.normalizePayoutResult(payload as MercadoPagoPayoutResponse, {});
  }

  private async exchangeAuthorizationCode(
    code: string,
  ): Promise<MercadoPagoOAuthTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.oauthRedirectUri,
    });

    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const payload = (await response.json().catch(() => ({}))) as
      | MercadoPagoOAuthTokenResponse
      | MercadoPagoErrorPayload;

    if (!response.ok) {
      const errorPayload = payload as MercadoPagoErrorPayload;
      throw new Error(
        errorPayload.message ||
          errorPayload.error ||
          `Mercado Pago OAuth failed with ${response.status}`,
      );
    }

    return payload as MercadoPagoOAuthTokenResponse;
  }

  private async getConnectedUserProfile(
    accessToken: string,
  ): Promise<MercadoPagoUserResponse> {
    const response = await fetch(this.userEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const payload = (await response.json().catch(() => ({}))) as
      | MercadoPagoUserResponse
      | MercadoPagoErrorPayload;

    if (!response.ok) {
      const errorPayload = payload as MercadoPagoErrorPayload;
      this.logger.warn(
        `Mercado Pago user profile lookup failed: ${
          errorPayload.message || errorPayload.error || response.statusText
        }`,
      );
      return {};
    }

    return payload as MercadoPagoUserResponse;
  }

  private normalizePayoutResult(
    payload: MercadoPagoPayoutResponse,
    context: {
      sellerProviderAccountId?: string;
      sellerProviderEmail?: string | null;
    },
  ): MercadoPagoSellerPayoutResult {
    const transaction = payload.transactions?.[0];
    const providerPayoutId = String(payload.id ?? transaction?.id ?? '');
    if (!providerPayoutId) {
      throw new Error('Mercado Pago no devolvió id de liquidación');
    }

    return {
      providerPayoutId,
      providerStatus: this.mapPayoutStatus(
        transaction?.status ?? payload.status,
      ),
      providerStatusDetail:
        transaction?.status_detail ?? payload.status_detail ?? null,
      metadata: {
        payoutId: payload.id === undefined ? undefined : String(payload.id),
        transactionId:
          transaction?.id === undefined ? undefined : String(transaction.id),
        sellerProviderAccountId: context.sellerProviderAccountId,
        sellerProviderEmail: context.sellerProviderEmail,
      },
    };
  }

  private mapPayoutStatus(
    status: string | null | undefined,
  ): 'processing' | 'completed' | 'failed' {
    const normalized = (status || '').toLowerCase();
    if (
      ['approved', 'completed', 'paid', 'processed', 'done'].includes(
        normalized,
      )
    ) {
      return 'completed';
    }
    if (
      ['rejected', 'cancelled', 'canceled', 'failed', 'error'].includes(
        normalized,
      )
    ) {
      return 'failed';
    }
    return 'processing';
  }

  private get clientId(): string {
    return (this.configService.get<string>('MP_OAUTH_CLIENT_ID') || '').trim();
  }

  private get clientSecret(): string {
    return (
      this.configService.get<string>('MP_OAUTH_CLIENT_SECRET') || ''
    ).trim();
  }

  private get oauthRedirectUri(): string {
    return (
      this.configService.get<string>('MP_OAUTH_REDIRECT_URI') || ''
    ).trim();
  }

  private get platformAccessToken(): string {
    return (this.configService.get<string>('MP_ACCESS_TOKEN') || '').trim();
  }
}

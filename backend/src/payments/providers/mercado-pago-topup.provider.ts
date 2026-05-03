import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import type {
  Payer,
  PreferenceRequest,
  PreferenceResponse,
} from 'mercadopago/dist/clients/preference/commonTypes';
import type { PaymentResponse } from 'mercadopago/dist/clients/payment/commonTypes';
import type {
  CreateCreditTopUpInput,
  CreateCreditTopUpResult,
  NormalizedTopUpWebhook,
  ProviderTopUpDetails,
  TopUpStatusResult,
} from './payment-provider.types';

export interface MercadoPagoWebhookPayload {
  type?: string;
  action?: string;
  data?: {
    id?: string | number;
  };
  id?: string | number;
  resource?: string;
}

interface MercadoPagoErrorPayload {
  message?: string;
}

type PreferenceRequestWithStatementDescriptor = PreferenceRequest & {
  statement_descriptor?: string;
};

@Injectable()
export class MercadoPagoTopUpProvider {
  private readonly logger = new Logger(MercadoPagoTopUpProvider.name);
  private readonly client?: MercadoPagoConfig;

  constructor(private readonly configService: ConfigService) {
    const accessToken = this.configService.get<string>('MP_ACCESS_TOKEN');
    if (accessToken) {
      this.client = new MercadoPagoConfig({ accessToken });
    }
  }

  isConfigured(): boolean {
    return Boolean(this.client);
  }

  private getClient(): MercadoPagoConfig {
    if (!this.client) {
      throw new BadRequestException(
        'Mercado Pago no está configurado para cargar Saldo LUK',
      );
    }
    return this.client;
  }

  private normalizeBaseUrl(
    value: string | undefined | null,
    fallback: string,
  ): string {
    const raw = (value || '').trim();
    const base = raw.length ? raw : fallback;
    const withScheme = /^https?:\/\//i.test(base) ? base : `http://${base}`;
    return withScheme.replace(/\/$/, '');
  }

  async createCreditTopUp(
    data: CreateCreditTopUpInput,
  ): Promise<CreateCreditTopUpResult> {
    const frontendUrl = this.normalizeBaseUrl(
      this.configService.get<string>('FRONTEND_URL'),
      'http://localhost:3000',
    );
    const backendUrl = this.normalizeBaseUrl(
      this.configService.get<string>('BACKEND_URL'),
      'http://localhost:3001',
    );
    const statusUrl = `${frontendUrl}/checkout/status`;
    const shouldAutoReturn =
      /^https:\/\//i.test(statusUrl) &&
      !/localhost|127\.0\.0\.1/i.test(statusUrl);

    const preference = new Preference(this.getClient());
    const body: PreferenceRequestWithStatementDescriptor = {
      items: [
        {
          id: data.topUpSessionId,
          title: 'Carga de saldo LUK',
          description: 'Saldo para tu wallet en LUK.',
          quantity: 1,
          unit_price: data.amount,
          currency_id: 'ARS',
        },
      ],
      back_urls: {
        success: statusUrl,
        failure: statusUrl,
        pending: statusUrl,
      },
      ...(shouldAutoReturn ? { auto_return: 'approved' as const } : {}),
      external_reference: data.providerReference,
      notification_url: `${backendUrl}/payments/webhook`,
      statement_descriptor: 'LUK SALDO',
      payer: this.buildPayer(data),
    };

    try {
      const response: PreferenceResponse = await preference.create({ body });
      if (!response.init_point || !response.id) {
        throw new BadRequestException(
          'Mercado Pago devolvió una carga de saldo inválida',
        );
      }
      return {
        redirectUrl: response.init_point,
        providerSessionId: response.id,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo crear la carga de Saldo LUK';
      this.logger.error(`MP top-up preference failed: ${message}`);
      throw new BadRequestException(message);
    }
  }

  async getTopUpStatus(paymentId: string): Promise<TopUpStatusResult> {
    const payment = new Payment(this.getClient());
    const paymentData = await payment.get({ id: paymentId });

    return {
      status: paymentData.status || 'unknown',
      statusDetail: paymentData.status_detail || '',
      externalReference: paymentData.external_reference || null,
      providerOrderId: paymentData.order?.id
        ? String(paymentData.order.id)
        : null,
    };
  }

  async getTopUp(paymentId: string): Promise<ProviderTopUpDetails> {
    const payment = new Payment(this.getClient());
    const paymentData: PaymentResponse = await payment.get({ id: paymentId });
    return {
      providerPaymentId: String(paymentData.id),
      status: paymentData.status || 'unknown',
      statusDetail: paymentData.status_detail || '',
      amount: Number(paymentData.transaction_amount ?? 0),
      externalReference: paymentData.external_reference ?? null,
      providerOrderId: paymentData.order?.id
        ? String(paymentData.order.id)
        : null,
      processingFee: Number(paymentData.fee_details?.[0]?.amount ?? 0),
    };
  }

  normalizeWebhook(
    payload: MercadoPagoWebhookPayload,
  ): NormalizedTopUpWebhook | null {
    const paymentId =
      payload.data?.id !== undefined
        ? String(payload.data.id)
        : payload.id !== undefined
          ? String(payload.id)
          : this.extractPaymentIdFromResource(payload.resource);

    if (!paymentId) {
      return null;
    }

    return {
      eventType: payload.type || payload.action || 'payment',
      paymentId,
      providerReference: null,
      providerOrderId: null,
      status: null,
      statusDetail: null,
    };
  }

  async refundTopUp(paymentId: string, amount?: number): Promise<void> {
    const normalizedAmount =
      typeof amount === 'number' && amount > 0
        ? Math.round(amount * 100) / 100
        : undefined;
    const client = this.getClient();
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}/refunds`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          'Content-Type': 'application/json',
        },
        body:
          normalizedAmount !== undefined
            ? JSON.stringify({ amount: normalizedAmount })
            : undefined,
      },
    );

    if (!response.ok) {
      const body = (await response
        .json()
        .catch(() => ({}))) as MercadoPagoErrorPayload;
      throw new Error(body.message || response.statusText);
    }
  }

  private buildPayer(data: CreateCreditTopUpInput): Payer {
    return {
      email: data.buyerProfile.email,
      name: data.buyerProfile.firstName ?? undefined,
      surname: data.buyerProfile.lastName ?? undefined,
    };
  }

  private extractPaymentIdFromResource(resource?: string): string | null {
    if (!resource) {
      return null;
    }

    const match = resource.match(/\/payments\/(\d+)/);
    return match?.[1] ?? null;
  }
}

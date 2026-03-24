import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import type {
  Payer,
  PreferenceRequest,
  PreferenceResponse,
} from 'mercadopago/dist/clients/preference/commonTypes';
import type { PaymentResponse } from 'mercadopago/dist/clients/payment/commonTypes';
import { getPlatformFeeRate } from '../../common/config/platform-fee.util';
import { TicketPurchaseMode } from '../../common/enums';
import {
  CheckoutBuyerProfile,
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  PaymentStatusResult,
} from './payment-provider.types';

interface ExtendedPreferenceRequest extends PreferenceRequest {
  money_release_days?: number;
}

const DEFAULT_MONEY_RELEASE_DAYS = 30;
const LOTTERY_CATEGORY_ID = 'lottery';

/**
 * Wraps direct Mercado Pago API calls behind a small provider interface used by the payments service.
 */
@Injectable()
export class MercadoPagoProvider {
  private readonly logger = new Logger(MercadoPagoProvider.name);
  private readonly client?: MercadoPagoConfig;

  constructor(private readonly configService: ConfigService) {
    const accessToken = this.configService.get<string>('MP_ACCESS_TOKEN');
    if (accessToken) {
      this.client = new MercadoPagoConfig({ accessToken });
    }
  }

  /**
   * Returns whether Mercado Pago credentials are available for live operations.
   */
  isConfigured(): boolean {
    return Boolean(this.client);
  }

  private getClient(): MercadoPagoConfig {
    if (!this.client) {
      throw new BadRequestException(
        'Mercado Pago no está configurado (MP_ACCESS_TOKEN faltante)',
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

  /**
   * Creates a Checkout Pro session for a ticket purchase and embeds Luk-specific metadata.
   */
  async createCheckoutSession(
    data: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult> {
    const platformFeeRate = getPlatformFeeRate(this.configService);
    const platformFee = data.cashChargedAmount * platformFeeRate;
    const frontendUrl = this.normalizeBaseUrl(
      this.configService.get<string>('FRONTEND_URL'),
      'http://localhost:3000',
    );
    const backendUrl = this.normalizeBaseUrl(
      this.configService.get<string>('BACKEND_URL'),
      'http://localhost:3001',
    );

    const successUrl = `${frontendUrl}/checkout/status`;
    const failureUrl = `${frontendUrl}/checkout/status`;
    const pendingUrl = `${frontendUrl}/checkout/status`;
    const shouldAutoReturn =
      /^https:\/\//i.test(successUrl) &&
      !/localhost|127\.0\.0\.1/i.test(successUrl);

    const preference = new Preference(this.getClient());
    const payer = this.buildPayer(data.buyerProfile);

    const preferenceBody: ExtendedPreferenceRequest = {
      items: [
        {
          id: data.raffleId,
          title: `${data.cantidad} Ticket(s) - ${data.tituloRifa}`,
          description: this.buildItemDescription(data),
          category_id: LOTTERY_CATEGORY_ID,
          quantity: 1,
          unit_price: data.cashChargedAmount,
          currency_id: 'ARS',
        },
      ],
      back_urls: {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl,
      },
      ...(shouldAutoReturn ? { auto_return: 'approved' as const } : {}),
      external_reference: JSON.stringify({
        raffleId: data.raffleId,
        buyerId: data.buyerId,
        cantidad: data.cantidad,
        reservationId: data.reservationId,
        bonusGrantId: data.bonusGrantId ?? null,
        grossSubtotal: data.grossSubtotal,
        discountApplied: data.discountApplied,
        mpChargeAmount: data.cashChargedAmount,
        promotionToken: data.promotionToken ?? null,
        purchaseMode: data.purchaseMode,
        selectedNumbers: data.selectedNumbers ?? null,
        selectionPremiumPercent: data.selectionPremiumPercent,
        selectionPremiumAmount: data.selectionPremiumAmount,
      }),
      marketplace_fee: platformFee,
      notification_url: `${backendUrl}/mp/webhook`,
      money_release_days: DEFAULT_MONEY_RELEASE_DAYS,
      ...(payer ? { payer } : {}),
    };

    try {
      const preferenceResponse: PreferenceResponse = await preference.create({
        body: preferenceBody,
      });

      return {
        initPoint: preferenceResponse.init_point!,
        preferenceId: preferenceResponse.id!,
      };
    } catch (error) {
      const details =
        error instanceof Error
          ? error.message
          : 'Mercado Pago preference create failed';
      this.logger.error(`MP preference create failed: ${details}`);
      throw new BadRequestException(details);
    }
  }

  /**
   * Fetches normalized status data for a Mercado Pago payment.
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResult> {
    const payment = new Payment(this.getClient());
    const paymentData = await payment.get({ id: paymentId });

    return {
      status: paymentData.status || 'unknown',
      statusDetail: paymentData.status_detail || '',
      externalReference: paymentData.external_reference || null,
      merchantOrderId: paymentData.order?.id
        ? String(paymentData.order.id)
        : null,
    };
  }

  /**
   * Retrieves the raw Mercado Pago payment payload.
   */
  async getPayment(paymentId: string): Promise<PaymentResponse> {
    const payment = new Payment(this.getClient());
    return payment.get({ id: paymentId });
  }

  /**
   * Requests a full or partial refund for a Mercado Pago payment.
   */
  async refundPayment(paymentId: string, amount?: number): Promise<void> {
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
      throw new Error(`Refund failed: ${response.statusText}`);
    }
  }

  /**
   * Releases a delayed-disbursement payment so Mercado Pago can pay out the seller.
   */
  async releasePayment(paymentId: string): Promise<void> {
    const client = this.getClient();
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}/releases`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      const errorMessage = errorData.message || response.statusText;
      if (
        response.status === 400 &&
        errorMessage.includes('already released')
      ) {
        return;
      }
      throw new Error(errorMessage);
    }
  }

  private buildItemDescription(data: CreateCheckoutSessionInput): string {
    if (
      data.purchaseMode === TicketPurchaseMode.CHOOSE_NUMBERS &&
      data.selectedNumbers &&
      data.selectedNumbers.length > 0
    ) {
      return `Compra de ${data.cantidad} ticket(s) elegidos (${data.selectedNumbers.join(', ')}) para la rifa "${data.tituloRifa}"`;
    }

    return `Compra de ${data.cantidad} ticket(s) para la rifa "${data.tituloRifa}"`;
  }

  private buildPayer(
    buyerProfile?: CheckoutBuyerProfile | null,
  ): Payer | undefined {
    if (!buyerProfile) {
      return undefined;
    }

    const payer: Payer = {
      email: buyerProfile.email,
      name: buyerProfile.firstName ?? undefined,
      surname: buyerProfile.lastName ?? undefined,
      authentication_type: buyerProfile.authenticationType ?? undefined,
      registration_date: buyerProfile.registrationDate ?? undefined,
      is_first_purchase_online: buyerProfile.isFirstPurchaseOnline,
      last_purchase: buyerProfile.lastPurchase ?? undefined,
    };

    if (buyerProfile.identificationType && buyerProfile.identificationNumber) {
      payer.identification = {
        type: buyerProfile.identificationType,
        number: buyerProfile.identificationNumber,
      };
    }

    if (buyerProfile.phone?.number || buyerProfile.phone?.areaCode) {
      payer.phone = {
        area_code: buyerProfile.phone.areaCode,
        number: buyerProfile.phone.number,
      };
    }

    if (
      buyerProfile.address?.zipCode ||
      buyerProfile.address?.streetName ||
      buyerProfile.address?.streetNumber
    ) {
      payer.address = {
        zip_code: buyerProfile.address.zipCode,
        street_name: buyerProfile.address.streetName,
        street_number: buyerProfile.address.streetNumber,
      };
    }

    return payer;
  }
}

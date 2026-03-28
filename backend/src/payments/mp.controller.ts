import {
  Controller,
  Post,
  Body,
  Res,
  Get,
  Query,
  Param,
  Logger,
  HttpStatus,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { Public } from '../auth/decorators/public.decorator';
import { verifyWebhookSignature } from './utils/webhook-signature.util';
import { captureException } from '../sentry';

/**
 * Mercado Pago webhook payload structure.
 * MP sends various formats depending on the notification type.
 */
interface MpWebhookPayload {
  id?: string | number;
  type?: string;
  topic?: string;
  action?: string;
  data?: {
    id?: string | number;
  };
}

/**
 * Type guard to check if the payload has a nested data.id
 */
function hasDataId(
  payload: unknown,
): payload is { data: { id: string | number } } {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'data' in payload &&
    typeof (payload as Record<string, unknown>).data === 'object' &&
    (payload as Record<string, unknown>).data !== null &&
    'id' in
      ((payload as Record<string, unknown>).data as Record<string, unknown>)
  );
}

/**
 * Type guard to check if the payload has a top-level id
 */
function hasTopLevelId(payload: unknown): payload is { id: string | number } {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'id' in payload &&
    (typeof (payload as Record<string, unknown>).id === 'string' ||
      typeof (payload as Record<string, unknown>).id === 'number')
  );
}

/**
 * Extract event ID from webhook payload using type guards
 */
function extractEventId(payload: unknown): string | number | undefined {
  if (hasDataId(payload)) {
    return payload.data.id;
  }
  if (hasTopLevelId(payload)) {
    return payload.id;
  }
  return undefined;
}

/**
 * Extract event type from webhook payload
 */
function extractEventType(payload: MpWebhookPayload): string | undefined {
  if (typeof payload.type === 'string') {
    return payload.type;
  }
  if (typeof payload.topic === 'string') {
    return payload.topic;
  }
  if (typeof payload.action === 'string') {
    return payload.action.split('.')[0];
  }
  return undefined;
}

/**
 * Handles Mercado Pago webhooks and payment status sync endpoints used by the frontend.
 */
@Controller('mp')
export class MpController {
  private readonly logger = new Logger(MpController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Receives Mercado Pago payment notifications and forwards valid events to the payments service.
   */
  @Post('webhook')
  @Public()
  async handleWebhook(
    @Body() body: MpWebhookPayload,
    @Headers('x-signature') xSignature: string | undefined,
    @Headers('x-request-id') xRequestId: string | undefined,
    @Res() res: Response,
  ) {
    const eventId = extractEventId(body);
    const eventType = extractEventType(body);

    this.logger.log(
      `Received MP webhook: type=${eventType ?? 'unknown'} id=${eventId ?? 'unknown'}`,
    );

    // Verify webhook signature in production
    const webhookSecret =
      this.configService.get<string>('MP_WEBHOOK_SECRET') ||
      this.configService.get<string>('MP_CLIENT_SECRET');
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    if (webhookSecret && eventId) {
      const verification = verifyWebhookSignature({
        xSignature,
        xRequestId,
        dataId: String(eventId),
        secret: webhookSecret,
      });

      if (!verification.valid) {
        this.logger.warn(
          `Webhook signature verification failed: ${verification.reason}`,
        );
        // In production, reject invalid signatures
        // In development, log warning but continue (for local testing with ngrok)
        if (isProduction) {
          return res.status(HttpStatus.UNAUTHORIZED).json({
            error: 'Invalid webhook signature',
            reason: verification.reason,
          });
        }
      }
    } else if (isProduction && !webhookSecret) {
      this.logger.warn(
        'MP_WEBHOOK_SECRET or MP_CLIENT_SECRET not configured - webhook signature verification disabled',
      );
    }

    if (!eventType || !eventId) {
      // Return 200 to prevent MP retries; bad payloads happen in local testing
      return res.status(HttpStatus.OK).json({ received: true, ignored: true });
    }

    try {
      await this.paymentsService.handleMpWebhook({
        type: eventType,
        data: { id: String(eventId) },
      });
      return res.status(HttpStatus.OK).json({ received: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error processing MP webhook: ${message}`);
      captureException(
        error instanceof Error
          ? error
          : new Error('MP webhook processing failed'),
        {
          tags: {
            service: 'luk-backend',
            domain: 'payments',
            stage: 'webhook',
          },
          extra: {
            eventId,
            eventType,
          },
        },
      );
      // Return 200 to prevent MP retries
      return res.status(HttpStatus.OK).json({
        received: true,
        error: message,
      });
    }
  }

  /**
   * Returns the latest payment status for the checkout return flow.
   */
  @Get('payment-status')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  async getPaymentStatus(
    @Query('payment_id') paymentId: string,
    @Res() res: Response,
  ) {
    if (!paymentId) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ error: 'payment_id required' });
    }

    try {
      // Opportunistically sync status to handle cases where webhook failed or local dev
      const syncResult =
        await this.paymentsService.syncPaymentStatus(paymentId);

      const status = await this.paymentsService.getPaymentStatus(paymentId);
      return res.status(HttpStatus.OK).json({
        ...status,
        syncResult,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting payment status: ${message}`);
      captureException(
        error instanceof Error
          ? error
          : new Error('Payment status lookup failed'),
        {
          tags: {
            service: 'luk-backend',
            domain: 'payments',
            stage: 'webhook',
          },
          extra: {
            paymentId,
          },
        },
      );
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: message,
      });
    }
  }

  /**
   * Forces a provider sync for a payment when webhook processing may have been missed.
   */
  @Get('sync-payment/:paymentId')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async syncPayment(
    @Param('paymentId') paymentId: string,
    @Res() res: Response,
  ) {
    if (!paymentId) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ error: 'paymentId required' });
    }

    try {
      const syncResult =
        await this.paymentsService.syncPaymentStatus(paymentId);
      this.logger.log(
        `Sync result for ${paymentId}: status=${syncResult.status} alreadyProcessed=${syncResult.alreadyProcessed} ticketsUpdated=${syncResult.ticketsUpdated}`,
      );
      return res.status(HttpStatus.OK).json(syncResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error syncing payment ${paymentId}: ${message}`);
      captureException(
        error instanceof Error ? error : new Error('Payment sync failed'),
        {
          tags: {
            service: 'luk-backend',
            domain: 'payments',
            stage: 'webhook',
          },
          extra: {
            paymentId,
          },
        },
      );
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: message,
        status: 'error',
      });
    }
  }
}

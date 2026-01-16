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

@Controller('mp')
export class MpController {
  private readonly logger = new Logger(MpController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Mercado Pago IPN (Instant Payment Notification) webhook endpoint.
   * MP sends notifications when payment status changes.
   * Verifies webhook signature using x-signature header.
   */
  @Post('webhook')
  @Public()
  async handleWebhook(
    @Body() body: any,
    @Headers('x-signature') xSignature: string | undefined,
    @Headers('x-request-id') xRequestId: string | undefined,
    @Res() res: Response,
  ) {
    const eventId = body?.data?.id ?? body?.id;
    const eventType =
      body?.type ??
      body?.topic ??
      (typeof body?.action === 'string' ? body.action.split('.')[0] : undefined);

    this.logger.log(
      `Received MP webhook: type=${eventType ?? 'unknown'} id=${eventId ?? 'unknown'}`,
    );

    // Verify webhook signature in production
    const webhookSecret = this.configService.get<string>('MP_WEBHOOK_SECRET') ||
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
        this.logger.warn(`Webhook signature verification failed: ${verification.reason}`);
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
      this.logger.warn('MP_WEBHOOK_SECRET or MP_CLIENT_SECRET not configured - webhook signature verification disabled');
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
      // Return 200 to prevent MP retries
      return res.status(HttpStatus.OK).json({
        received: true,
        error: message,
      });
    }
  }

  /**
   * Endpoint to check payment status (used when user returns from MP checkout).
   * Rate limited to prevent enumeration attacks.
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
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'payment_id required' });
    }

    try {
      // Opportunistically sync status to handle cases where webhook failed or local dev
      const syncResult = await this.paymentsService.syncPaymentStatus(paymentId);

      const status = await this.paymentsService.getPaymentStatus(paymentId);
      return res.status(HttpStatus.OK).json({
        ...status,
        syncResult,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting payment status: ${message}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: message,
      });
    }
  }

  /**
   * Dedicated sync endpoint - forces a sync with Mercado Pago.
   * Used by frontend when webhook may have failed.
   * Rate limited to prevent abuse.
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
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'paymentId required' });
    }

    try {
      const syncResult = await this.paymentsService.syncPaymentStatus(paymentId);
      this.logger.log(
        `Sync result for ${paymentId}: status=${syncResult.status} alreadyProcessed=${syncResult.alreadyProcessed} ticketsUpdated=${syncResult.ticketsUpdated}`,
      );
      return res.status(HttpStatus.OK).json(syncResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error syncing payment ${paymentId}: ${message}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: message,
        status: 'error',
      });
    }
  }
}

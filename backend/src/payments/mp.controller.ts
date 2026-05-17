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
  Req,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { Public } from '../auth/decorators/public.decorator';
import { captureException } from '../sentry';
import type { MercadoPagoWebhookPayload } from './providers/mercado-pago-topup.provider';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
  };
}

/**
 * Handles provider webhooks and payment status sync endpoints used by the frontend.
 */
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Starts Mercado Pago OAuth so sellers can receive LUK payouts in their MP wallet.
   */
  @Get('account')
  @UseGuards(JwtAuthGuard)
  async connectSellerPaymentAccount(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    if (!req.user?.id) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ error: 'unauthorized' });
    }

    const authorizationUrl =
      this.paymentsService.startSellerPaymentAccountConnection(req.user.id);
    return res.redirect(authorizationUrl);
  }

  /**
   * Completes Mercado Pago seller OAuth and returns the user to Settings.
   */
  @Get('account/callback')
  @Public()
  async sellerPaymentAccountCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') oauthError: string,
    @Res() res: Response,
  ) {
    const frontendUrl = (
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ).replace(/\/$/, '');

    if (oauthError) {
      return res.redirect(
        `${frontendUrl}/dashboard/settings?tab=payments&mp_account=error`,
      );
    }

    if (!code || !state) {
      return res.redirect(
        `${frontendUrl}/dashboard/settings?tab=payments&mp_account=missing`,
      );
    }

    try {
      await this.paymentsService.completeSellerPaymentAccountConnection(
        code,
        state,
      );
      return res.redirect(
        `${frontendUrl}/dashboard/settings?tab=payments&mp_account=connected`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error connecting seller MP account: ${message}`);
      captureException(
        error instanceof Error
          ? error
          : new Error('Seller MP account connection failed'),
        {
          tags: {
            service: 'luk-backend',
            domain: 'payments',
            stage: 'seller-account-callback',
          },
        },
      );
      return res.redirect(
        `${frontendUrl}/dashboard/settings?tab=payments&mp_account=error`,
      );
    }
  }

  /**
   * Returns the current user's seller payment-account status.
   */
  @Get('account/status')
  @UseGuards(JwtAuthGuard)
  async getSellerPaymentAccountStatus(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    if (!req.user?.id) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ error: 'unauthorized' });
    }

    const status = await this.paymentsService.getSellerPaymentAccountStatus(
      req.user.id,
    );
    return res.status(HttpStatus.OK).json(status);
  }

  /**
   * Disconnects the Mercado Pago account used for seller payouts.
   */
  @Post('account/disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnectSellerPaymentAccount(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    if (!req.user?.id) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ error: 'unauthorized' });
    }

    await this.paymentsService.disconnectSellerPaymentAccount(req.user.id);
    return res.status(HttpStatus.OK).json({ disconnected: true });
  }

  /**
   * Receives payment-provider notifications and forwards valid events to the payments service.
   */
  @Post('webhook')
  @Public()
  async handleWebhook(
    @Body() body: MercadoPagoWebhookPayload,
    @Res() res: Response,
  ) {
    try {
      await this.paymentsService.handleProviderWebhook(body);
      return res.status(HttpStatus.OK).json({ received: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error processing provider webhook: ${message}`);
      captureException(
        error instanceof Error
          ? error
          : new Error('Provider webhook processing failed'),
        {
          tags: {
            service: 'luk-backend',
            domain: 'payments',
            stage: 'webhook',
          },
          extra: { body },
        },
      );
      return res.status(HttpStatus.OK).json({
        received: true,
        error: message,
      });
    }
  }

  /**
   * Returns the latest top-up status for the checkout return flow.
   */
  @Get('status')
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
   * Forces a provider sync for a top-up when webhook processing may have been missed.
   */
  @Get('sync/:paymentId')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async syncPayment(
    @Param('paymentId') providerTransactionId: string,
    @Res() res: Response,
  ) {
    if (!providerTransactionId) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ error: 'paymentId required' });
    }

    try {
      const syncResult = await this.paymentsService.syncPaymentStatus(
        providerTransactionId,
      );
      this.logger.log(
        `Sync result for ${providerTransactionId}: status=${syncResult.status} alreadyProcessed=${syncResult.alreadyProcessed} creditedAmount=${syncResult.creditedAmount}`,
      );
      return res.status(HttpStatus.OK).json(syncResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error syncing payment ${providerTransactionId}: ${message}`,
      );
      captureException(
        error instanceof Error ? error : new Error('Payment sync failed'),
        {
          tags: {
            service: 'luk-backend',
            domain: 'payments',
            stage: 'webhook',
          },
          extra: {
            paymentId: providerTransactionId,
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

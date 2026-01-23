import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import Stripe from 'stripe';

// Extend Request to include rawBody and stripeEvent
interface StripeWebhookRequest extends Request {
  rawBody?: Buffer;
  stripeEvent?: Stripe.Event;
}

@Injectable()
export class StripeWebhookGuard implements CanActivate {
  private readonly logger = new Logger(StripeWebhookGuard.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(private configService: ConfigService) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY') || '',
    );
    this.webhookSecret =
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<StripeWebhookRequest>();
    const signature = request.headers['stripe-signature'];

    if (!signature) {
      this.logger.warn('Missing stripe-signature header');
      throw new UnauthorizedException('Missing stripe-signature header');
    }

    try {
      const rawBody = request.rawBody;

      if (!rawBody) {
        this.logger.error(
          'Raw body not available. Make sure rawBody is enabled in NestFactory',
        );
        throw new UnauthorizedException('Unable to verify webhook signature');
      }

      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );

      // Attach the verified event to the request for downstream use
      request.stripeEvent = event;
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Webhook signature verification failed: ${message}`);
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { PaymentsService } from './payments.service';
import type { MockPaymentAction } from './providers/payment-provider.types';

interface MockPaymentActionBody {
  publicToken?: string;
  action?: MockPaymentAction;
  amount?: number;
}

@Controller('payments/mock')
export class MockPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get(':mockPaymentId')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getMockPayment(
    @Param('mockPaymentId') mockPaymentId: string,
    @Query('token') publicToken: string,
  ) {
    if (!publicToken) {
      throw new BadRequestException('token requerido');
    }

    return this.paymentsService.getMockPaymentForCheckout(
      mockPaymentId,
      publicToken,
    );
  }

  @Post(':mockPaymentId/action')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async applyMockAction(
    @Param('mockPaymentId') mockPaymentId: string,
    @Body() body: MockPaymentActionBody,
  ) {
    if (!body.publicToken) {
      throw new BadRequestException('publicToken requerido');
    }

    if (!body.action) {
      throw new BadRequestException('action requerida');
    }

    return this.paymentsService.processMockPaymentAction(
      mockPaymentId,
      body.publicToken,
      body.action,
      body.amount,
    );
  }
}

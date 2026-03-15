import { Module, forwardRef } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsResolver } from './tickets.resolver';
import { PaymentsModule } from '../payments/payments.module';
import { SocialPromotionsModule } from '../social-promotions/social-promotions.module';

@Module({
  imports: [forwardRef(() => PaymentsModule), SocialPromotionsModule],
  providers: [TicketsService, TicketsResolver],
  exports: [TicketsService],
})
export class TicketsModule {}

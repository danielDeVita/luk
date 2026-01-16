import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsResolver } from './tickets.resolver';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PaymentsModule],
  providers: [TicketsService, TicketsResolver],
  exports: [TicketsService],
})
export class TicketsModule {}

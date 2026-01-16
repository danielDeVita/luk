import { Module } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { DisputesResolver } from './disputes.resolver';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PaymentsModule, NotificationsModule],
  providers: [DisputesService, DisputesResolver],
  exports: [DisputesService],
})
export class DisputesModule {}

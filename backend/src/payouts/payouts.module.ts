import { Module, forwardRef } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { PayoutsResolver } from './payouts.resolver';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PrismaModule, NotificationsModule, forwardRef(() => PaymentsModule)],
  providers: [PayoutsService, PayoutsResolver],
  exports: [PayoutsService],
})
export class PayoutsModule {}

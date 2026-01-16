import { Module } from '@nestjs/common';
import { RaffleTasksService } from './raffle-tasks.service';
import { DisputeTasksService } from './dispute-tasks.service';
import { CleanupTasksService } from './cleanup-tasks.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PayoutsModule } from '../payouts/payouts.module';

@Module({
  imports: [PrismaModule, PaymentsModule, NotificationsModule, PayoutsModule],
  providers: [RaffleTasksService, DisputeTasksService, CleanupTasksService],
})
export class TasksModule {}

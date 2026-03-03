import { Module } from '@nestjs/common';
import { RafflesService } from './raffles.service';
import { RafflesResolver } from './raffles.resolver';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { PayoutsModule } from '../payouts/payouts.module';

@Module({
  imports: [NotificationsModule, UsersModule, PayoutsModule],
  providers: [RafflesService, RafflesResolver],
})
export class RafflesModule {}

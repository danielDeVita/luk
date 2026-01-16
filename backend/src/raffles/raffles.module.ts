import { Module } from '@nestjs/common';
import { RafflesService } from './raffles.service';
import { RafflesResolver } from './raffles.resolver';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [RafflesService, RafflesResolver],
})
export class RafflesModule {}

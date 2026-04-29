import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsResolver } from './tickets.resolver';
import { SocialPromotionsModule } from '../social-promotions/social-promotions.module';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityModule } from '../activity/activity.module';
import { PayoutsModule } from '../payouts/payouts.module';

@Module({
  imports: [
    WalletModule,
    SocialPromotionsModule,
    NotificationsModule,
    ActivityModule,
    PayoutsModule,
  ],
  providers: [TicketsService, TicketsResolver],
  exports: [TicketsService],
})
export class TicketsModule {}

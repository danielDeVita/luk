import { Module } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { DisputesResolver } from './disputes.resolver';
import { NotificationsModule } from '../notifications/notifications.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule, NotificationsModule],
  providers: [DisputesService, DisputesResolver],
  exports: [DisputesService],
})
export class DisputesModule {}

import { Module } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { ReferralsResolver } from './referrals.resolver';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [ReferralsService, ReferralsResolver],
  exports: [ReferralsService],
})
export class ReferralsModule {}

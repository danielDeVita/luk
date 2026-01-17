import { Module, forwardRef } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { MpController } from './mp.controller';
import { MpConnectController } from './mp-connect.controller';
import { MpConnectService } from './mp-connect.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    forwardRef(() => ReferralsModule),
    AuthModule, // For JwtService in MP Connect
  ],
  controllers: [MpController, MpConnectController],
  providers: [PaymentsService, MpConnectService],
  exports: [PaymentsService, MpConnectService],
})
export class PaymentsModule {}

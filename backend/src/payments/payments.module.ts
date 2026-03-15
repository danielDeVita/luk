import { Module, forwardRef } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { MpController } from './mp.controller';
import { MockPaymentsController } from './mock-payments.controller';
import { MpConnectController } from './mp-connect.controller';
import { MpConnectService } from './mp-connect.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { AuthModule } from '../auth/auth.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { SocialPromotionsModule } from '../social-promotions/social-promotions.module';
import { MercadoPagoProvider } from './providers/mercado-pago.provider';
import { MockPaymentProvider } from './providers/mock-payment.provider';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    forwardRef(() => ReferralsModule),
    forwardRef(() => PayoutsModule),
    forwardRef(() => SocialPromotionsModule),
    AuthModule, // For JwtService in MP Connect
  ],
  controllers: [MpController, MockPaymentsController, MpConnectController],
  providers: [
    PaymentsService,
    MpConnectService,
    MercadoPagoProvider,
    MockPaymentProvider,
  ],
  exports: [PaymentsService, MpConnectService],
})
export class PaymentsModule {}

import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './mp.controller';
import { MockPaymentsController } from './mock-payments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { SocialPromotionsModule } from '../social-promotions/social-promotions.module';
import { WalletModule } from '../wallet/wallet.module';
import { MercadoPagoTopUpProvider } from './providers/mercado-pago-topup.provider';
import { MockPaymentProvider } from './providers/mock-payment.provider';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    NotificationsModule,
    forwardRef(() => WalletModule),
    forwardRef(() => PayoutsModule),
    forwardRef(() => SocialPromotionsModule),
  ],
  controllers: [PaymentsController, MockPaymentsController],
  providers: [PaymentsService, MercadoPagoTopUpProvider, MockPaymentProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}

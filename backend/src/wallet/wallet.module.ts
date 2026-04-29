import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';
import { WalletResolver } from './wallet.resolver';
import { WalletService } from './wallet.service';

@Module({
  imports: [PrismaModule, forwardRef(() => PaymentsModule)],
  providers: [WalletService, WalletResolver],
  exports: [WalletService],
})
export class WalletModule {}

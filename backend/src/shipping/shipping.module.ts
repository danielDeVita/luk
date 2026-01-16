import { Module } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { ShippingResolver } from './shipping.resolver';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ShippingService, ShippingResolver],
  exports: [ShippingService],
})
export class ShippingModule {}

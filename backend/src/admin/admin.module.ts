import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminResolver } from './admin.resolver';
import { PrismaModule } from '../prisma/prisma.module';
import { DisputesModule } from '../disputes/disputes.module';

@Module({
  imports: [PrismaModule, DisputesModule],
  providers: [AdminService, AdminResolver],
})
export class AdminModule {}

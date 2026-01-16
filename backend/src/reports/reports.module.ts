import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsResolver } from './reports.resolver';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ReportsService, ReportsResolver],
  exports: [ReportsService],
})
export class ReportsModule {}

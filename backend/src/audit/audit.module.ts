import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditResolver } from './audit.resolver';
import { PrismaModule } from '../prisma/prisma.module';

@Global() // Make AuditService available globally for other services to use
@Module({
  imports: [PrismaModule],
  providers: [AuditService, AuditResolver],
  exports: [AuditService],
})
export class AuditModule {}

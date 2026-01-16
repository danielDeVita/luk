import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, AuditAction } from '@prisma/client';

@Resolver(() => AuditLog)
export class AuditResolver {
  constructor(private auditService: AuditService) {}

  @Query(() => [AuditLog])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async auditLogs(
    @Args('adminId', { nullable: true }) adminId?: string,
    @Args('action', { nullable: true, type: () => String }) action?: string,
    @Args('targetType', { nullable: true }) targetType?: string,
    @Args('targetId', { nullable: true }) targetId?: string,
    @Args('limit', { nullable: true, type: () => Int }) limit?: number,
    @Args('offset', { nullable: true, type: () => Int }) offset?: number,
  ) {
    const result = await this.auditService.getAuditLogs({
      adminId,
      action: action as AuditAction | undefined,
      targetType,
      targetId,
      limit,
      offset,
    });

    return result.logs.map((log) => ({
      ...log,
      details: log.details ? JSON.stringify(log.details) : null,
      adminEmail: log.admin.email,
    }));
  }

  @Query(() => [AuditLog])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async auditLogsForTarget(
    @Args('targetType') targetType: string,
    @Args('targetId') targetId: string,
  ) {
    const logs = await this.auditService.getAuditLogsForTarget(
      targetType,
      targetId,
    );
    return logs.map((log) => ({
      ...log,
      details: log.details ? JSON.stringify(log.details) : null,
      adminEmail: log.admin.email,
    }));
  }
}

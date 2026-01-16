import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  database: boolean;
  version?: string;
}

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get()
  async check(): Promise<HealthCheckResponse> {
    let dbOk = false;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    return {
      status: dbOk ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbOk,
      version: process.env.npm_package_version || '1.0.0',
    };
  }

  @Public()
  @Get('ready')
  async readiness(): Promise<{ ready: boolean }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ready: true };
    } catch {
      return { ready: false };
    }
  }

  @Public()
  @Get('live')
  liveness(): { alive: boolean } {
    return { alive: true };
  }
}

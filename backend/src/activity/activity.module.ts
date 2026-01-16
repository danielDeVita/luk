import { Global, Module } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { PrismaService } from '../prisma/prisma.service';

@Global()
@Module({
  providers: [ActivityService, PrismaService],
  exports: [ActivityService],
})
export class ActivityModule {}

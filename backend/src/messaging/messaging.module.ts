import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { MessagingResolver } from './messaging.resolver';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [MessagingService, MessagingResolver],
  exports: [MessagingService],
})
export class MessagingModule {}

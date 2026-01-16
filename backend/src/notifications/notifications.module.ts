import { Module, Global } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { NotificationsService } from './notifications.service';
import { NotificationsResolver } from './notifications.resolver';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    NotificationsService,
    NotificationsResolver,
    {
      provide: 'PUB_SUB',
      useValue: new PubSub(),
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}

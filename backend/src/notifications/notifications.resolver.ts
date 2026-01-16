import { Resolver, Query, Mutation, Args, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';

@Resolver(() => Notification)
export class NotificationsResolver {
  constructor(
    private readonly notificationsService: NotificationsService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  @Query(() => [Notification])
  @UseGuards(GqlAuthGuard)
  async myNotifications(@CurrentUser() user: User) {
    return this.notificationsService.findAll(user.id);
  }

  @Mutation(() => Notification)
  @UseGuards(GqlAuthGuard)
  async markNotificationRead(@Args('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async markAllNotificationsRead(@CurrentUser() user: User) {
    await this.notificationsService.markAllAsRead(user.id);
    return true;
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async testEmail(@CurrentUser() user: User) {
    return this.notificationsService.sendWelcomeEmail(user.email, {
      userName: user.nombre,
    });
  }

  @Subscription(() => Notification, {
    name: 'notificationAdded',
    filter: (payload: any, _variables: any, context: any) => {
      const userId = context?.user?.id ?? context?.req?.user?.id;
      return !!userId && payload?.notificationAdded?.userId === userId;
    },
    resolve: (payload: any) => payload.notificationAdded,
  })
  notificationAdded() {
    return (this.pubSub as any).asyncIterator('notificationAdded');
  }
}

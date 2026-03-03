import { Resolver, Query, Mutation, Args, Subscription } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { PubSubEngine } from 'graphql-subscriptions';

// Type definitions for subscription payload and context
interface NotificationPayload {
  notificationAdded: Notification & { userId: string };
}

interface SubscriptionContext {
  user?: { id: string };
  req?: { user?: { id: string } };
}

@Resolver(() => Notification)
export class NotificationsResolver {
  constructor(
    private readonly notificationsService: NotificationsService,
    @Inject('PUB_SUB') private readonly pubSub: PubSubEngine,
  ) {}

  @Query(() => [Notification])
  @UseGuards(GqlAuthGuard)
  async myNotifications(@CurrentUser() user: User) {
    return this.notificationsService.findAll(user.id);
  }

  @Mutation(() => Notification)
  @UseGuards(GqlAuthGuard)
  async markNotificationRead(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ) {
    return this.notificationsService.markAsRead(id, user.id);
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
    filter: (
      payload: NotificationPayload,
      _variables: Record<string, unknown>,
      context: SubscriptionContext,
    ) => {
      const userId = context?.user?.id ?? context?.req?.user?.id;
      return !!userId && payload?.notificationAdded?.userId === userId;
    },
    resolve: (payload: NotificationPayload) => payload.notificationAdded,
  })
  notificationAdded(): AsyncIterableIterator<NotificationPayload> {
    return this.pubSub.asyncIterableIterator<NotificationPayload>(
      'notificationAdded',
    );
  }
}

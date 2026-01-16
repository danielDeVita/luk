import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { Conversation, Message } from './entities/conversation.entity';
import {
  SendMessageInput,
  StartConversationInput,
} from './dto/messaging.input';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Resolver(() => Conversation)
export class MessagingResolver {
  constructor(private messagingService: MessagingService) {}

  @Query(() => [Conversation])
  @UseGuards(JwtAuthGuard)
  async myConversations(@CurrentUser() user: { id: string }) {
    return this.messagingService.getUserConversations(user.id);
  }

  @Query(() => Conversation)
  @UseGuards(JwtAuthGuard)
  async conversation(
    @CurrentUser() user: { id: string },
    @Args('id') id: string,
  ) {
    return this.messagingService.getConversation(user.id, id);
  }

  @Mutation(() => Conversation)
  @UseGuards(JwtAuthGuard)
  async startConversation(
    @CurrentUser() user: { id: string },
    @Args('input') input: StartConversationInput,
  ) {
    return this.messagingService.startConversation(user.id, input);
  }

  @Mutation(() => Message)
  @UseGuards(JwtAuthGuard)
  async sendMessage(
    @CurrentUser() user: { id: string },
    @Args('input') input: SendMessageInput,
  ) {
    return this.messagingService.sendMessage(user.id, input);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async closeConversation(
    @CurrentUser() user: { id: string },
    @Args('conversationId') conversationId: string,
  ) {
    return this.messagingService.closeConversation(user.id, conversationId);
  }
}

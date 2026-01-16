import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Message {
  @Field(() => ID)
  id!: string;

  @Field()
  conversationId!: string;

  @Field()
  senderId!: string;

  @Field()
  content!: string;

  @Field()
  isRead!: boolean;

  @Field()
  createdAt!: Date;

  @Field({ nullable: true })
  senderName?: string;
}

@ObjectType()
export class Conversation {
  @Field(() => ID)
  id!: string;

  @Field()
  raffleId!: string;

  @Field()
  user1Id!: string;

  @Field()
  user2Id!: string;

  @Field()
  isActive!: boolean;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field(() => [Message], { nullable: 'items' })
  messages?: Message[];

  @Field({ nullable: true })
  raffleTitulo?: string;

  @Field({ nullable: true })
  otherUserName?: string;

  @Field({ nullable: true })
  lastMessage?: string;

  @Field({ nullable: true })
  unreadCount?: number;
}

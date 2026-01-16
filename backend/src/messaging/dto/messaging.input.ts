import { InputType, Field } from '@nestjs/graphql';
import { IsString, MinLength, MaxLength } from 'class-validator';

@InputType()
export class SendMessageInput {
  @Field()
  @IsString()
  conversationId!: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}

@InputType()
export class StartConversationInput {
  @Field()
  @IsString()
  raffleId!: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  initialMessage!: string;
}

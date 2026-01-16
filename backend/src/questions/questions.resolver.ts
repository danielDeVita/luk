import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import {
  RaffleQuestion,
  RaffleAnswer,
} from './entities/raffle-question.entity';
import { AskQuestionInput, AnswerQuestionInput } from './dto/question.input';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Resolver()
export class QuestionsResolver {
  constructor(private readonly questionsService: QuestionsService) {}

  /**
   * Get all questions for a raffle (public).
   */
  @Public()
  @Query(() => [RaffleQuestion], { name: 'raffleQuestions' })
  async getRaffleQuestions(@Args('raffleId') raffleId: string) {
    return this.questionsService.getQuestionsByRaffle(raffleId);
  }

  /**
   * Ask a question on a raffle (authenticated).
   */
  @Mutation(() => RaffleQuestion)
  @UseGuards(GqlAuthGuard)
  async askQuestion(
    @CurrentUser() user: User,
    @Args('input') input: AskQuestionInput,
  ) {
    return this.questionsService.askQuestion(user.id, input);
  }

  /**
   * Answer a question (seller only).
   */
  @Mutation(() => RaffleAnswer)
  @UseGuards(GqlAuthGuard)
  async answerQuestion(
    @CurrentUser() user: User,
    @Args('input') input: AnswerQuestionInput,
  ) {
    return this.questionsService.answerQuestion(user.id, input);
  }

  /**
   * Delete a question (owner or admin).
   */
  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async deleteQuestion(
    @CurrentUser() user: User,
    @Args('questionId') questionId: string,
  ) {
    return this.questionsService.deleteQuestion(user.id, user.role, questionId);
  }
}

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AskQuestionInput, AnswerQuestionInput } from './dto/question.input';
import { UserRole, RaffleStatus } from '@prisma/client';

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all questions (with answers) for a specific raffle.
   * Public endpoint - no authentication required.
   */
  async getQuestionsByRaffle(raffleId: string) {
    // Verify raffle exists
    const raffle = await this.prisma.raffle.findUnique({
      where: { id: raffleId },
      select: { id: true, isDeleted: true, isHidden: true },
    });

    if (!raffle || raffle.isDeleted || raffle.isHidden) {
      throw new NotFoundException('Rifa no encontrada');
    }

    return this.prisma.raffleQuestion.findMany({
      where: { raffleId },
      include: {
        asker: {
          select: { id: true, nombre: true, apellido: true, avatarUrl: true },
        },
        answer: {
          include: {
            seller: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Ask a question on a raffle.
   * User must be authenticated.
   */
  async askQuestion(askerId: string, input: AskQuestionInput) {
    // Verify raffle exists and is active
    const raffle = await this.prisma.raffle.findUnique({
      where: { id: input.raffleId },
      select: {
        id: true,
        sellerId: true,
        estado: true,
        isDeleted: true,
        isHidden: true,
      },
    });

    if (!raffle || raffle.isDeleted || raffle.isHidden) {
      throw new NotFoundException('Rifa no encontrada');
    }

    if (raffle.estado !== RaffleStatus.ACTIVA) {
      throw new BadRequestException(
        'Solo se pueden hacer preguntas en rifas activas',
      );
    }

    // Seller cannot ask questions on their own raffle
    if (raffle.sellerId === askerId) {
      throw new BadRequestException(
        'No podés hacer preguntas en tu propia rifa',
      );
    }

    return this.prisma.raffleQuestion.create({
      data: {
        raffleId: input.raffleId,
        askerId,
        content: input.content,
      },
      include: {
        asker: {
          select: { id: true, nombre: true, apellido: true, avatarUrl: true },
        },
        answer: true,
      },
    });
  }

  /**
   * Answer a question on a raffle.
   * Only the raffle seller can answer.
   */
  async answerQuestion(sellerId: string, input: AnswerQuestionInput) {
    // Get the question with raffle info
    const question = await this.prisma.raffleQuestion.findUnique({
      where: { id: input.questionId },
      include: {
        raffle: { select: { sellerId: true } },
        answer: true,
      },
    });

    if (!question) {
      throw new NotFoundException('Pregunta no encontrada');
    }

    if (question.answer) {
      throw new BadRequestException('Esta pregunta ya tiene una respuesta');
    }

    // Only the raffle seller can answer
    if (question.raffle.sellerId !== sellerId) {
      throw new ForbiddenException(
        'Solo el vendedor puede responder preguntas',
      );
    }

    return this.prisma.raffleAnswer.create({
      data: {
        questionId: input.questionId,
        sellerId,
        content: input.content,
      },
      include: {
        seller: {
          select: { id: true, nombre: true, apellido: true, avatarUrl: true },
        },
        question: {
          include: {
            asker: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Delete a question.
   * Only the question author or admin can delete.
   */
  async deleteQuestion(userId: string, userRole: UserRole, questionId: string) {
    const question = await this.prisma.raffleQuestion.findUnique({
      where: { id: questionId },
      select: { id: true, askerId: true },
    });

    if (!question) {
      throw new NotFoundException('Pregunta no encontrada');
    }

    // Only author or admin can delete
    if (question.askerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'No tenés permiso para eliminar esta pregunta',
      );
    }

    await this.prisma.raffleQuestion.delete({
      where: { id: questionId },
    });

    return true;
  }
}

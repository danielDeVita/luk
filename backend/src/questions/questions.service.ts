import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AskQuestionInput, AnswerQuestionInput } from './dto/question.input';
import { UserRole, RaffleStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

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
        titulo: true,
        sellerId: true,
        estado: true,
        isDeleted: true,
        isHidden: true,
        seller: {
          select: { id: true, email: true, nombre: true, apellido: true },
        },
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

    // Get asker info for notification
    const asker = await this.prisma.user.findUnique({
      where: { id: askerId },
      select: { nombre: true, apellido: true },
    });

    const question = await this.prisma.raffleQuestion.create({
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

    // Notify seller about new question
    if (raffle.seller && asker) {
      this.notifySellerAboutQuestion(
        raffle.seller,
        raffle.titulo,
        input.content,
        `${asker.nombre} ${asker.apellido}`,
        raffle.id,
      ).catch((error: unknown) => {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Failed to notify seller about question: ${errorMsg}`,
        );
      });
    }

    return question;
  }

  private async notifySellerAboutQuestion(
    seller: { id: string; email: string; nombre: string; apellido: string },
    raffleName: string,
    questionContent: string,
    askerName: string,
    raffleId: string,
  ) {
    const sellerName = `${seller.nombre} ${seller.apellido}`;

    // Send email notification
    await this.notificationsService.sendNewQuestionNotification(seller.email, {
      sellerName,
      raffleName,
      questionContent,
      askerName,
      raffleId,
    });

    // Create in-app notification
    await this.notificationsService.create(
      seller.id,
      'INFO',
      'Nueva pregunta',
      `${askerName} preguntó en "${raffleName}": "${questionContent.substring(0, 50)}${questionContent.length > 50 ? '...' : ''}"`,
    );
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
        raffle: {
          select: {
            id: true,
            titulo: true,
            sellerId: true,
            seller: {
              select: { nombre: true, apellido: true },
            },
          },
        },
        asker: {
          select: { id: true, email: true, nombre: true, apellido: true },
        },
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

    const answer = await this.prisma.raffleAnswer.create({
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

    // Notify buyer about the answer
    if (question.asker && question.raffle.seller) {
      this.notifyBuyerAboutAnswer(
        question.asker,
        question.raffle.titulo,
        question.content,
        input.content,
        `${question.raffle.seller.nombre} ${question.raffle.seller.apellido}`,
        question.raffle.id,
      ).catch((error: unknown) => {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to notify buyer about answer: ${errorMsg}`);
      });
    }

    return answer;
  }

  private async notifyBuyerAboutAnswer(
    buyer: { id: string; email: string; nombre: string; apellido: string },
    raffleName: string,
    questionContent: string,
    answerContent: string,
    sellerName: string,
    raffleId: string,
  ) {
    const buyerName = `${buyer.nombre} ${buyer.apellido}`;

    // Send email notification
    await this.notificationsService.sendQuestionAnsweredNotification(
      buyer.email,
      {
        buyerName,
        raffleName,
        questionContent,
        answerContent,
        sellerName,
        raffleId,
      },
    );

    // Create in-app notification
    await this.notificationsService.create(
      buyer.id,
      'INFO',
      'Pregunta respondida',
      `${sellerName} respondió tu pregunta en "${raffleName}": "${answerContent.substring(0, 50)}${answerContent.length > 50 ? '...' : ''}"`,
    );
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

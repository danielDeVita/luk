import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  SendMessageInput,
  StartConversationInput,
} from './dto/messaging.input';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async startConversation(userId: string, input: StartConversationInput) {
    // Check if raffle exists
    const raffle = await this.prisma.raffle.findUnique({
      where: { id: input.raffleId },
      select: {
        id: true,
        sellerId: true,
        winnerId: true,
        titulo: true,
        estado: true,
      },
    });

    if (!raffle) {
      throw new NotFoundException('Rifa no encontrada');
    }

    // Only winner can start conversation with seller
    if (raffle.winnerId !== userId && raffle.sellerId !== userId) {
      throw new ForbiddenException(
        'Solo el ganador o vendedor pueden iniciar conversacion',
      );
    }

    // Determine user roles
    const isWinner = raffle.winnerId === userId;
    const user1Id = isWinner ? userId : raffle.winnerId!;
    const user2Id = isWinner ? raffle.sellerId : userId;

    if (!user1Id) {
      throw new BadRequestException('Esta rifa aun no tiene ganador');
    }

    // Check if conversation already exists
    let conversation = await this.prisma.conversation.findUnique({
      where: { raffleId: input.raffleId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (conversation) {
      // Just send the message to existing conversation
      await this.sendMessage(userId, {
        conversationId: conversation.id,
        content: input.initialMessage,
      });

      return this.prisma.conversation.findUnique({
        where: { id: conversation.id },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    }

    // Create new conversation with initial message
    conversation = await this.prisma.conversation.create({
      data: {
        raffleId: input.raffleId,
        user1Id,
        user2Id,
        messages: {
          create: {
            senderId: userId,
            content: input.initialMessage,
          },
        },
      },
      include: {
        messages: true,
      },
    });

    // Notify the other user
    const recipientId = userId === user1Id ? user2Id : user1Id;
    await this.notifications.create(
      recipientId,
      'INFO',
      'Nuevo mensaje',
      `Tienes un nuevo mensaje sobre "${raffle.titulo}"`,
      '/dashboard/messages',
    );

    this.logger.log(`Conversation started for raffle ${input.raffleId}`);
    return conversation;
  }

  async sendMessage(userId: string, input: SendMessageInput) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: input.conversationId },
      include: { raffle: { select: { titulo: true } } },
    });

    if (!conversation) {
      throw new NotFoundException('Conversacion no encontrada');
    }

    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException('No tienes acceso a esta conversacion');
    }

    if (!conversation.isActive) {
      throw new BadRequestException('Esta conversacion esta cerrada');
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId: input.conversationId,
        senderId: userId,
        content: input.content,
      },
    });

    // Update conversation timestamp
    await this.prisma.conversation.update({
      where: { id: input.conversationId },
      data: { updatedAt: new Date() },
    });

    // Notify recipient
    const recipientId =
      conversation.user1Id === userId
        ? conversation.user2Id
        : conversation.user1Id;
    await this.notifications.create(
      recipientId,
      'INFO',
      'Nuevo mensaje',
      `Nuevo mensaje sobre "${conversation.raffle.titulo}"`,
      '/dashboard/messages',
    );

    this.logger.log(`Message sent in conversation ${input.conversationId}`);
    return message;
  }

  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: { select: { id: true, nombre: true, apellido: true } },
          },
        },
        raffle: { select: { titulo: true } },
        user1: { select: { id: true, nombre: true, apellido: true } },
        user2: { select: { id: true, nombre: true, apellido: true } },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversacion no encontrada');
    }

    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException('No tienes acceso a esta conversacion');
    }

    // Mark messages as read
    await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });

    const otherUser =
      conversation.user1Id === userId ? conversation.user2 : conversation.user1;

    return {
      ...conversation,
      raffleTitulo: conversation.raffle.titulo,
      otherUserName: `${otherUser.nombre} ${otherUser.apellido}`,
      messages: conversation.messages.map((m) => ({
        ...m,
        senderName: `${m.sender.nombre} ${m.sender.apellido}`,
      })),
    };
  }

  async getUserConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        raffle: { select: { titulo: true } },
        user1: { select: { id: true, nombre: true, apellido: true } },
        user2: { select: { id: true, nombre: true, apellido: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            messages: {
              where: { senderId: { not: userId }, isRead: false },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return conversations.map((conv) => {
      const otherUser = conv.user1Id === userId ? conv.user2 : conv.user1;
      return {
        ...conv,
        raffleTitulo: conv.raffle.titulo,
        otherUserName: `${otherUser.nombre} ${otherUser.apellido}`,
        lastMessage: conv.messages[0]?.content ?? null,
        unreadCount: conv._count.messages,
      };
    });
  }

  async closeConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversacion no encontrada');
    }

    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException('No tienes acceso a esta conversacion');
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { isActive: false },
    });

    this.logger.log(`Conversation ${conversationId} closed by ${userId}`);
    return true;
  }
}

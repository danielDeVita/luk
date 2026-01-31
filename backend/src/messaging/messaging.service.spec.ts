import { Test, TestingModule } from '@nestjs/testing';
import { MessagingService } from './messaging.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

type MockPrismaService = {
  raffle: {
    findUnique: jest.Mock;
  };
  conversation: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  message: {
    create: jest.Mock;
    updateMany: jest.Mock;
  };
};

type MockNotificationsService = {
  create: jest.Mock;
};

describe('MessagingService', () => {
  let service: MessagingService;
  let prisma: MockPrismaService;
  let notifications: MockNotificationsService;

  const mockPrismaService = (): MockPrismaService => ({
    raffle: {
      findUnique: jest.fn(),
    },
    conversation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    message: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  });

  const mockNotificationsService = (): MockNotificationsService => ({
    create: jest.fn(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingService,
        { provide: PrismaService, useValue: mockPrismaService() },
        { provide: NotificationsService, useValue: mockNotificationsService() },
      ],
    }).compile();

    service = module.get<MessagingService>(MessagingService);
    prisma = module.get(PrismaService) as unknown as MockPrismaService;
    notifications = module.get(
      NotificationsService,
    ) as unknown as MockNotificationsService;
  });

  describe('startConversation', () => {
    it('should create new conversation with initial message', async () => {
      const mockRaffle = {
        id: 'raffle-1',
        sellerId: 'seller-1',
        winnerId: 'winner-1',
        titulo: 'iPhone 15 Pro',
        estado: 'SORTEADA',
      };

      prisma.raffle.findUnique.mockResolvedValue(mockRaffle);
      prisma.conversation.findUnique.mockResolvedValue(null); // No existing conversation
      prisma.conversation.create.mockResolvedValue({
        id: 'conv-1',
        raffleId: 'raffle-1',
        user1Id: 'winner-1',
        user2Id: 'seller-1',
        messages: [{ senderId: 'winner-1', content: 'Hello!' }],
      });
      notifications.create.mockResolvedValue(true);

      const result = await service.startConversation('winner-1', {
        raffleId: 'raffle-1',
        initialMessage: 'Hello!',
      });

      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: {
          raffleId: 'raffle-1',
          user1Id: 'winner-1',
          user2Id: 'seller-1',
          messages: {
            create: {
              senderId: 'winner-1',
              content: 'Hello!',
            },
          },
        },
        include: {
          messages: true,
        },
      });
      expect(notifications.create).toHaveBeenCalledWith(
        'seller-1',
        'INFO',
        'Nuevo mensaje',
        expect.stringContaining('iPhone 15 Pro'),
      );
      expect(result).toBeDefined();
      expect(result!.id).toBe('conv-1');
    });

    it('should add message to existing conversation', async () => {
      const mockRaffle = {
        id: 'raffle-1',
        sellerId: 'seller-1',
        winnerId: 'winner-1',
        titulo: 'iPhone 15 Pro',
        estado: 'SORTEADA',
      };

      const mockConversation = {
        id: 'conv-1',
        raffleId: 'raffle-1',
        user1Id: 'winner-1',
        user2Id: 'seller-1',
        isActive: true,
        messages: [],
      };

      prisma.raffle.findUnique.mockResolvedValue(mockRaffle);
      prisma.conversation.findUnique
        .mockResolvedValueOnce(mockConversation) // First call in startConversation
        .mockResolvedValueOnce({
          ...mockConversation,
          raffle: { titulo: 'iPhone 15 Pro' },
        }) // Second call in sendMessage
        .mockResolvedValueOnce({
          ...mockConversation,
          messages: [{ content: 'New message' }],
        }); // Final return

      prisma.message.create.mockResolvedValue({
        id: 'msg-1',
        content: 'New message',
      });
      prisma.conversation.update.mockResolvedValue({});
      notifications.create.mockResolvedValue(true);

      const result = await service.startConversation('winner-1', {
        raffleId: 'raffle-1',
        initialMessage: 'New message',
      });

      expect(prisma.conversation.create).not.toHaveBeenCalled();
      expect(prisma.message.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if raffle not found', async () => {
      prisma.raffle.findUnique.mockResolvedValue(null);

      await expect(
        service.startConversation('winner-1', {
          raffleId: 'invalid-id',
          initialMessage: 'Hello',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is neither winner nor seller', async () => {
      const mockRaffle = {
        id: 'raffle-1',
        sellerId: 'seller-1',
        winnerId: 'winner-1',
        titulo: 'iPhone',
        estado: 'SORTEADA',
      };

      prisma.raffle.findUnique.mockResolvedValue(mockRaffle);

      await expect(
        service.startConversation('random-user', {
          raffleId: 'raffle-1',
          initialMessage: 'Hello',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if raffle has no winner yet', async () => {
      const mockRaffle = {
        id: 'raffle-1',
        sellerId: 'seller-1',
        winnerId: null,
        titulo: 'iPhone',
        estado: 'ACTIVA',
      };

      prisma.raffle.findUnique.mockResolvedValue(mockRaffle);
      prisma.conversation.findUnique.mockResolvedValue(null);

      await expect(
        service.startConversation('seller-1', {
          raffleId: 'raffle-1',
          initialMessage: 'Hello',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      const mockConversation = {
        id: 'conv-1',
        user1Id: 'winner-1',
        user2Id: 'seller-1',
        isActive: true,
        raffle: { titulo: 'iPhone 15 Pro' },
      };

      prisma.conversation.findUnique.mockResolvedValue(mockConversation);
      prisma.message.create.mockResolvedValue({
        id: 'msg-1',
        content: 'Test message',
      });
      prisma.conversation.update.mockResolvedValue({});
      notifications.create.mockResolvedValue(true);

      const result = await service.sendMessage('winner-1', {
        conversationId: 'conv-1',
        content: 'Test message',
      });

      expect(prisma.message.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv-1',
          senderId: 'winner-1',
          content: 'Test message',
        },
      });
      expect(notifications.create).toHaveBeenCalledWith(
        'seller-1',
        'INFO',
        'Nuevo mensaje',
        expect.any(String),
      );
      expect(result).toBeDefined();
      expect(result!.id).toBe('msg-1');
    });

    it('should throw NotFoundException if conversation not found', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);

      await expect(
        service.sendMessage('user-1', {
          conversationId: 'invalid-id',
          content: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user not part of conversation', async () => {
      const mockConversation = {
        id: 'conv-1',
        user1Id: 'winner-1',
        user2Id: 'seller-1',
        isActive: true,
      };

      prisma.conversation.findUnique.mockResolvedValue(mockConversation);

      await expect(
        service.sendMessage('random-user', {
          conversationId: 'conv-1',
          content: 'Test',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if conversation is closed', async () => {
      const mockConversation = {
        id: 'conv-1',
        user1Id: 'winner-1',
        user2Id: 'seller-1',
        isActive: false,
      };

      prisma.conversation.findUnique.mockResolvedValue(mockConversation);

      await expect(
        service.sendMessage('winner-1', {
          conversationId: 'conv-1',
          content: 'Test',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getConversation', () => {
    it('should return conversation with messages and mark as read', async () => {
      const mockConversation = {
        id: 'conv-1',
        user1Id: 'winner-1',
        user2Id: 'seller-1',
        messages: [
          {
            id: 'msg-1',
            content: 'Hello',
            sender: { id: 'winner-1', nombre: 'John', apellido: 'Doe' },
          },
        ],
        raffle: { titulo: 'iPhone 15 Pro' },
        user1: { id: 'winner-1', nombre: 'John', apellido: 'Doe' },
        user2: { id: 'seller-1', nombre: 'Jane', apellido: 'Smith' },
      };

      prisma.conversation.findUnique.mockResolvedValue(mockConversation);
      prisma.message.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.getConversation('winner-1', 'conv-1');

      expect(prisma.message.updateMany).toHaveBeenCalledWith({
        where: {
          conversationId: 'conv-1',
          senderId: { not: 'winner-1' },
          isRead: false,
        },
        data: { isRead: true },
      });
      expect(result.raffleTitulo).toBe('iPhone 15 Pro');
      expect(result.otherUserName).toBe('Jane Smith');
    });

    it('should throw NotFoundException if conversation not found', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);

      await expect(
        service.getConversation('user-1', 'invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user not part of conversation', async () => {
      const mockConversation = {
        id: 'conv-1',
        user1Id: 'winner-1',
        user2Id: 'seller-1',
        messages: [],
      };

      prisma.conversation.findUnique.mockResolvedValue(mockConversation);

      await expect(
        service.getConversation('random-user', 'conv-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getUserConversations', () => {
    it('should return all conversations for user with unread counts', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          user1Id: 'user-1',
          user2Id: 'seller-1',
          raffle: { titulo: 'iPhone 15 Pro' },
          user1: { id: 'user-1', nombre: 'John', apellido: 'Doe' },
          user2: { id: 'seller-1', nombre: 'Jane', apellido: 'Smith' },
          messages: [{ content: 'Last message' }],
          _count: { messages: 3 },
        },
      ];

      prisma.conversation.findMany.mockResolvedValue(mockConversations);

      const result = await service.getUserConversations('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].raffleTitulo).toBe('iPhone 15 Pro');
      expect(result[0].otherUserName).toBe('Jane Smith');
      expect(result[0].lastMessage).toBe('Last message');
      expect(result[0].unreadCount).toBe(3);
    });
  });

  describe('closeConversation', () => {
    it('should close conversation successfully', async () => {
      const mockConversation = {
        id: 'conv-1',
        user1Id: 'winner-1',
        user2Id: 'seller-1',
        isActive: true,
      };

      prisma.conversation.findUnique.mockResolvedValue(mockConversation);
      prisma.conversation.update.mockResolvedValue({
        ...mockConversation,
        isActive: false,
      });

      const result = await service.closeConversation('winner-1', 'conv-1');

      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: { isActive: false },
      });
      expect(result).toBe(true);
    });

    it('should throw NotFoundException if conversation not found', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);

      await expect(
        service.closeConversation('user-1', 'invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user not part of conversation', async () => {
      const mockConversation = {
        id: 'conv-1',
        user1Id: 'winner-1',
        user2Id: 'seller-1',
      };

      prisma.conversation.findUnique.mockResolvedValue(mockConversation);

      await expect(
        service.closeConversation('random-user', 'conv-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

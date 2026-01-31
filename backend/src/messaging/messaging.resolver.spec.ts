import { Test, TestingModule } from '@nestjs/testing';
import { MessagingResolver } from './messaging.resolver';
import { MessagingService } from './messaging.service';

type MockMessagingService = {
  getUserConversations: jest.Mock;
  getConversation: jest.Mock;
  startConversation: jest.Mock;
  sendMessage: jest.Mock;
  closeConversation: jest.Mock;
};

describe('MessagingResolver', () => {
  let resolver: MessagingResolver;
  let service: MockMessagingService;

  const mockMessagingService = (): MockMessagingService => ({
    getUserConversations: jest.fn(),
    getConversation: jest.fn(),
    startConversation: jest.fn(),
    sendMessage: jest.fn(),
    closeConversation: jest.fn(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingResolver,
        { provide: MessagingService, useValue: mockMessagingService() },
      ],
    }).compile();

    resolver = module.get<MessagingResolver>(MessagingResolver);
    service = module.get(MessagingService) as unknown as MockMessagingService;
  });

  describe('myConversations', () => {
    it('should return all user conversations', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          raffleId: 'raffle-1',
          raffleTitulo: 'iPhone 15 Pro',
          otherUserId: 'seller-1',
          otherUserName: 'Vendedor Test',
          lastMessage: 'Hola, consulta sobre el envío',
          unreadCount: 2,
          updatedAt: new Date(),
        },
        {
          id: 'conv-2',
          raffleId: 'raffle-2',
          raffleTitulo: 'MacBook Pro',
          otherUserId: 'winner-2',
          otherUserName: 'Comprador Test',
          lastMessage: 'Perfecto, gracias!',
          unreadCount: 0,
          updatedAt: new Date(),
        },
      ];

      service.getUserConversations.mockResolvedValue(mockConversations);

      const result = await resolver.myConversations({ id: 'user-1' });

      expect(service.getUserConversations).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockConversations);
      expect(result).toHaveLength(2);
    });
  });

  describe('conversation', () => {
    it('should return specific conversation by ID', async () => {
      const mockConversation = {
        id: 'conv-1',
        raffleId: 'raffle-1',
        raffleTitulo: 'iPhone 15 Pro',
        otherUserId: 'seller-1',
        otherUserName: 'Vendedor Test',
        messages: [
          {
            id: 'msg-1',
            senderId: 'user-1',
            content: 'Hola, ¿hacés envíos?',
            senderName: 'Comprador Test',
            createdAt: new Date(),
          },
          {
            id: 'msg-2',
            senderId: 'seller-1',
            content: 'Sí, envío a todo el país',
            senderName: 'Vendedor Test',
            createdAt: new Date(),
          },
        ],
      };

      service.getConversation.mockResolvedValue(mockConversation);

      const result = await resolver.conversation({ id: 'user-1' }, 'conv-1');

      expect(service.getConversation).toHaveBeenCalledWith('user-1', 'conv-1');
      expect(result).toEqual(mockConversation);
      expect(result.messages).toHaveLength(2);
    });
  });

  describe('startConversation', () => {
    it('should start a new conversation', async () => {
      const input = {
        raffleId: 'raffle-1',
        initialMessage: 'Hola, gané el sorteo. ¿Cuándo envías?',
      };

      const mockConversation = {
        id: 'conv-new',
        raffleId: 'raffle-1',
        user1Id: 'winner-1',
        user2Id: 'seller-1',
        messages: [
          {
            id: 'msg-1',
            senderId: 'winner-1',
            content: 'Hola, gané el sorteo. ¿Cuándo envías?',
          },
        ],
      };

      service.startConversation.mockResolvedValue(mockConversation);

      const result = await resolver.startConversation(
        { id: 'winner-1' },
        input,
      );

      expect(service.startConversation).toHaveBeenCalledWith('winner-1', input);
      expect(result).toEqual(mockConversation);
    });

    it('should pass user ID and input to service', async () => {
      const input = {
        raffleId: 'raffle-2',
        initialMessage: '¿Acepta cambios?',
      };

      service.startConversation.mockResolvedValue({
        id: 'conv-2',
        raffleId: 'raffle-2',
      });

      await resolver.startConversation({ id: 'user-2' }, input);

      expect(service.startConversation).toHaveBeenCalledWith('user-2', input);
    });
  });

  describe('sendMessage', () => {
    it('should send a message', async () => {
      const input = {
        conversationId: 'conv-1',
        content: 'Te envío el número de seguimiento en breve',
      };

      const mockMessage = {
        id: 'msg-new',
        conversationId: 'conv-1',
        senderId: 'seller-1',
        content: 'Te envío el número de seguimiento en breve',
        createdAt: new Date(),
        isRead: false,
      };

      service.sendMessage.mockResolvedValue(mockMessage);

      const result = await resolver.sendMessage({ id: 'seller-1' }, input);

      expect(service.sendMessage).toHaveBeenCalledWith('seller-1', input);
      expect(result).toEqual(mockMessage);
    });
  });

  describe('closeConversation', () => {
    it('should close a conversation', async () => {
      service.closeConversation.mockResolvedValue(true);

      const result = await resolver.closeConversation(
        { id: 'user-1' },
        'conv-1',
      );

      expect(service.closeConversation).toHaveBeenCalledWith(
        'user-1',
        'conv-1',
      );
      expect(result).toBe(true);
    });
  });
});

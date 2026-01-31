import { Test, TestingModule } from '@nestjs/testing';
import { QuestionsService } from './questions.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { RaffleStatus, UserRole } from '@prisma/client';

type MockPrismaService = {
  raffle: {
    findUnique: jest.Mock;
  };
  raffleQuestion: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  raffleAnswer: {
    create: jest.Mock;
  };
  user: {
    findUnique: jest.Mock;
  };
};

type MockNotificationsService = {
  sendNewQuestionNotification: jest.Mock;
  sendQuestionAnsweredNotification: jest.Mock;
  create: jest.Mock;
};

describe('QuestionsService', () => {
  let service: QuestionsService;
  let prisma: MockPrismaService;
  let notifications: MockNotificationsService;

  const mockPrismaService = (): MockPrismaService => ({
    raffle: {
      findUnique: jest.fn(),
    },
    raffleQuestion: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    raffleAnswer: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  });

  const mockNotificationsService = (): MockNotificationsService => ({
    sendNewQuestionNotification: jest.fn(),
    sendQuestionAnsweredNotification: jest.fn(),
    create: jest.fn(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionsService,
        { provide: PrismaService, useValue: mockPrismaService() },
        { provide: NotificationsService, useValue: mockNotificationsService() },
      ],
    }).compile();

    service = module.get<QuestionsService>(QuestionsService);
    prisma = module.get(PrismaService) as unknown as MockPrismaService;
    notifications = module.get(
      NotificationsService,
    ) as unknown as MockNotificationsService;
  });

  describe('getQuestionsByRaffle', () => {
    it('should return all questions for a raffle', async () => {
      const mockRaffle = { id: 'raffle-1', isDeleted: false, isHidden: false };
      const mockQuestions = [
        {
          id: 'q1',
          content: 'Question 1',
          asker: { id: 'user-1', nombre: 'John', apellido: 'Doe' },
          answer: null,
        },
        {
          id: 'q2',
          content: 'Question 2',
          asker: { id: 'user-2', nombre: 'Jane', apellido: 'Smith' },
          answer: {
            content: 'Answer 2',
            seller: { id: 'seller-1', nombre: 'Seller' },
          },
        },
      ];

      prisma.raffle.findUnique.mockResolvedValue(mockRaffle);
      prisma.raffleQuestion.findMany.mockResolvedValue(mockQuestions);

      const result = await service.getQuestionsByRaffle('raffle-1');

      expect(prisma.raffleQuestion.findMany).toHaveBeenCalledWith({
        where: { raffleId: 'raffle-1' },
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
      expect(result).toEqual(mockQuestions);
    });

    it('should throw NotFoundException if raffle not found', async () => {
      prisma.raffle.findUnique.mockResolvedValue(null);

      await expect(service.getQuestionsByRaffle('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if raffle is deleted', async () => {
      prisma.raffle.findUnique.mockResolvedValue({
        id: 'raffle-1',
        isDeleted: true,
        isHidden: false,
      });

      await expect(service.getQuestionsByRaffle('raffle-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if raffle is hidden', async () => {
      prisma.raffle.findUnique.mockResolvedValue({
        id: 'raffle-1',
        isDeleted: false,
        isHidden: true,
      });

      await expect(service.getQuestionsByRaffle('raffle-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('askQuestion', () => {
    it('should create question and notify seller', async () => {
      const mockRaffle = {
        id: 'raffle-1',
        titulo: 'iPhone 15 Pro',
        sellerId: 'seller-1',
        estado: RaffleStatus.ACTIVA,
        isDeleted: false,
        isHidden: false,
        seller: {
          id: 'seller-1',
          email: 'seller@test.com',
          nombre: 'Seller',
          apellido: 'Name',
        },
      };

      const mockAsker = { nombre: 'John', apellido: 'Doe' };
      const mockQuestion = {
        id: 'q1',
        content: 'Is this new?',
        asker: { id: 'user-1', nombre: 'John', apellido: 'Doe' },
        answer: null,
      };

      prisma.raffle.findUnique.mockResolvedValue(mockRaffle);
      prisma.user.findUnique.mockResolvedValue(mockAsker);
      prisma.raffleQuestion.create.mockResolvedValue(mockQuestion);
      notifications.sendNewQuestionNotification.mockResolvedValue(true);
      notifications.create.mockResolvedValue(true);

      const result = await service.askQuestion('user-1', {
        raffleId: 'raffle-1',
        content: 'Is this new?',
      });

      expect(prisma.raffleQuestion.create).toHaveBeenCalledWith({
        data: {
          raffleId: 'raffle-1',
          askerId: 'user-1',
          content: 'Is this new?',
        },
        include: {
          asker: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              avatarUrl: true,
            },
          },
          answer: true,
        },
      });
      expect(notifications.sendNewQuestionNotification).toHaveBeenCalledWith(
        'seller@test.com',
        {
          sellerName: 'Seller Name',
          raffleName: 'iPhone 15 Pro',
          questionContent: 'Is this new?',
          askerName: 'John Doe',
          raffleId: 'raffle-1',
        },
      );
      expect(notifications.create).toHaveBeenCalledWith(
        'seller-1',
        'INFO',
        'Nueva pregunta',
        expect.stringContaining('John Doe preguntó'),
      );
      expect(result).toEqual(mockQuestion);
    });

    it('should throw NotFoundException if raffle not found', async () => {
      prisma.raffle.findUnique.mockResolvedValue(null);

      await expect(
        service.askQuestion('user-1', {
          raffleId: 'invalid-id',
          content: 'Test?',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if raffle not active', async () => {
      prisma.raffle.findUnique.mockResolvedValue({
        id: 'raffle-1',
        sellerId: 'seller-1',
        estado: RaffleStatus.SORTEADA,
        isDeleted: false,
        isHidden: false,
      });

      await expect(
        service.askQuestion('user-1', {
          raffleId: 'raffle-1',
          content: 'Test?',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if seller asks on own raffle', async () => {
      prisma.raffle.findUnique.mockResolvedValue({
        id: 'raffle-1',
        sellerId: 'seller-1',
        estado: RaffleStatus.ACTIVA,
        isDeleted: false,
        isHidden: false,
      });

      await expect(
        service.askQuestion('seller-1', {
          raffleId: 'raffle-1',
          content: 'Test?',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('answerQuestion', () => {
    it('should create answer and notify asker', async () => {
      const mockQuestion = {
        id: 'q1',
        content: 'Is this new?',
        raffle: {
          id: 'raffle-1',
          titulo: 'iPhone 15 Pro',
          sellerId: 'seller-1',
          seller: { nombre: 'Seller', apellido: 'Name' },
        },
        asker: {
          id: 'user-1',
          email: 'buyer@test.com',
          nombre: 'John',
          apellido: 'Doe',
        },
        answer: null,
      };

      const mockAnswer = {
        id: 'a1',
        content: 'Yes, brand new!',
        seller: { id: 'seller-1', nombre: 'Seller', apellido: 'Name' },
        question: mockQuestion,
      };

      prisma.raffleQuestion.findUnique.mockResolvedValue(mockQuestion);
      prisma.raffleAnswer.create.mockResolvedValue(mockAnswer);
      notifications.sendQuestionAnsweredNotification.mockResolvedValue(true);
      notifications.create.mockResolvedValue(true);

      const result = await service.answerQuestion('seller-1', {
        questionId: 'q1',
        content: 'Yes, brand new!',
      });

      expect(prisma.raffleAnswer.create).toHaveBeenCalledWith({
        data: {
          questionId: 'q1',
          sellerId: 'seller-1',
          content: 'Yes, brand new!',
        },
        include: {
          seller: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              avatarUrl: true,
            },
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
      expect(
        notifications.sendQuestionAnsweredNotification,
      ).toHaveBeenCalledWith('buyer@test.com', {
        buyerName: 'John Doe',
        raffleName: 'iPhone 15 Pro',
        questionContent: 'Is this new?',
        answerContent: 'Yes, brand new!',
        sellerName: 'Seller Name',
        raffleId: 'raffle-1',
      });
      expect(result).toEqual(mockAnswer);
    });

    it('should throw NotFoundException if question not found', async () => {
      prisma.raffleQuestion.findUnique.mockResolvedValue(null);

      await expect(
        service.answerQuestion('seller-1', {
          questionId: 'invalid-id',
          content: 'Answer',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if already answered', async () => {
      prisma.raffleQuestion.findUnique.mockResolvedValue({
        id: 'q1',
        raffle: { sellerId: 'seller-1' },
        answer: { id: 'a1', content: 'Already answered' },
      });

      await expect(
        service.answerQuestion('seller-1', {
          questionId: 'q1',
          content: 'Another answer',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if not the seller', async () => {
      prisma.raffleQuestion.findUnique.mockResolvedValue({
        id: 'q1',
        raffle: { sellerId: 'seller-1' },
        answer: null,
      });

      await expect(
        service.answerQuestion('other-user', {
          questionId: 'q1',
          content: 'Answer',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteQuestion', () => {
    it('should allow author to delete question', async () => {
      prisma.raffleQuestion.findUnique.mockResolvedValue({
        id: 'q1',
        askerId: 'user-1',
      });
      prisma.raffleQuestion.delete.mockResolvedValue({});

      const result = await service.deleteQuestion(
        'user-1',
        UserRole.USER,
        'q1',
      );

      expect(prisma.raffleQuestion.delete).toHaveBeenCalledWith({
        where: { id: 'q1' },
      });
      expect(result).toBe(true);
    });

    it('should allow admin to delete any question', async () => {
      prisma.raffleQuestion.findUnique.mockResolvedValue({
        id: 'q1',
        askerId: 'user-1',
      });
      prisma.raffleQuestion.delete.mockResolvedValue({});

      const result = await service.deleteQuestion(
        'admin-user',
        UserRole.ADMIN,
        'q1',
      );

      expect(prisma.raffleQuestion.delete).toHaveBeenCalledWith({
        where: { id: 'q1' },
      });
      expect(result).toBe(true);
    });

    it('should throw NotFoundException if question not found', async () => {
      prisma.raffleQuestion.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteQuestion('user-1', UserRole.USER, 'invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not author or admin', async () => {
      prisma.raffleQuestion.findUnique.mockResolvedValue({
        id: 'q1',
        askerId: 'user-1',
      });

      await expect(
        service.deleteQuestion('other-user', UserRole.USER, 'q1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

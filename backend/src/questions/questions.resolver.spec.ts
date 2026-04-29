import { Test, TestingModule } from '@nestjs/testing';
import { QuestionsResolver } from './questions.resolver';
import { QuestionsService } from './questions.service';
import { User, UserRole } from '@prisma/client';

type MockQuestionsService = {
  getQuestionsByRaffle: jest.Mock;
  askQuestion: jest.Mock;
  answerQuestion: jest.Mock;
  deleteQuestion: jest.Mock;
};

describe('QuestionsResolver', () => {
  let resolver: QuestionsResolver;
  let service: MockQuestionsService;

  const mockQuestionsService = (): MockQuestionsService => ({
    getQuestionsByRaffle: jest.fn(),
    askQuestion: jest.fn(),
    answerQuestion: jest.fn(),
    deleteQuestion: jest.fn(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionsResolver,
        { provide: QuestionsService, useValue: mockQuestionsService() },
      ],
    }).compile();

    resolver = module.get<QuestionsResolver>(QuestionsResolver);
    service = module.get(QuestionsService) as unknown as MockQuestionsService;
  });

  describe('getRaffleQuestions', () => {
    it('should return all questions for a raffle (public endpoint)', async () => {
      const mockQuestions = [
        {
          id: 'q1',
          raffleId: 'raffle-1',
          askerId: 'user-1',
          content: '¿El producto es nuevo?',
          asker: {
            id: 'user-1',
            nombre: 'Juan',
            apellido: 'Pérez',
          },
          answer: null,
        },
        {
          id: 'q2',
          raffleId: 'raffle-1',
          askerId: 'user-2',
          content: '¿Cuándo termina el sorteo?',
          asker: {
            id: 'user-2',
            nombre: 'María',
            apellido: 'García',
          },
          answer: {
            id: 'a1',
            content: 'Termina el 15 de febrero',
            seller: {
              id: 'seller-1',
              nombre: 'Vendedor',
              apellido: 'Test',
            },
          },
        },
      ];

      service.getQuestionsByRaffle.mockResolvedValue(mockQuestions);

      const result = await resolver.getRaffleQuestions('raffle-1');

      expect(service.getQuestionsByRaffle).toHaveBeenCalledWith('raffle-1');
      expect(result).toEqual(mockQuestions);
      expect(result).toHaveLength(2);
    });

    it('should return empty array if raffle has no questions', async () => {
      service.getQuestionsByRaffle.mockResolvedValue([]);

      const result = await resolver.getRaffleQuestions('raffle-2');

      expect(service.getQuestionsByRaffle).toHaveBeenCalledWith('raffle-2');
      expect(result).toEqual([]);
    });
  });

  describe('askQuestion', () => {
    it('should create a new question', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@test.com',
        role: UserRole.USER,
      } as User;

      const input = {
        raffleId: 'raffle-1',
        content: '¿Aceptás transferencias bancarias?',
      };

      const mockQuestion = {
        id: 'q-new',
        raffleId: 'raffle-1',
        askerId: 'user-1',
        content: '¿Aceptás transferencias bancarias?',
        asker: {
          id: 'user-1',
          nombre: 'Juan',
          apellido: 'Pérez',
        },
        answer: null,
      };

      service.askQuestion.mockResolvedValue(mockQuestion);

      const result = await resolver.askQuestion(mockUser, input);

      expect(service.askQuestion).toHaveBeenCalledWith('user-1', input);
      expect(result).toEqual(mockQuestion);
    });

    it('should pass user ID and input to service', async () => {
      const mockUser = {
        id: 'user-2',
        email: 'buyer@test.com',
        role: UserRole.USER,
      } as User;

      const input = {
        raffleId: 'raffle-2',
        content: '¿Hacés envíos a todo el país?',
      };

      service.askQuestion.mockResolvedValue({
        id: 'q-2',
        ...input,
        askerId: 'user-2',
      });

      await resolver.askQuestion(mockUser, input);

      expect(service.askQuestion).toHaveBeenCalledWith('user-2', input);
    });
  });

  describe('answerQuestion', () => {
    it('should create an answer to a question', async () => {
      const mockUser = {
        id: 'seller-1',
        email: 'seller@test.com',
        role: UserRole.USER,
      } as User;

      const input = {
        questionId: 'q1',
        content: 'Sí, aceptamos todos los medios de pago',
      };

      const mockAnswer = {
        id: 'a-new',
        questionId: 'q1',
        sellerId: 'seller-1',
        content: 'Sí, aceptamos todos los medios de pago',
        seller: {
          id: 'seller-1',
          nombre: 'Vendedor',
          apellido: 'Test',
        },
      };

      service.answerQuestion.mockResolvedValue(mockAnswer);

      const result = await resolver.answerQuestion(mockUser, input);

      expect(service.answerQuestion).toHaveBeenCalledWith('seller-1', input);
      expect(result).toEqual(mockAnswer);
    });
  });

  describe('deleteQuestion', () => {
    it('should delete a question (owner)', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@test.com',
        role: UserRole.USER,
      } as User;

      service.deleteQuestion.mockResolvedValue(true);

      const result = await resolver.deleteQuestion(mockUser, 'q1');

      expect(service.deleteQuestion).toHaveBeenCalledWith(
        'user-1',
        UserRole.USER,
        'q1',
      );
      expect(result).toBe(true);
    });

    it('should delete a question (admin)', async () => {
      const mockAdmin = {
        id: 'admin-1',
        email: 'admin@test.com',
        role: UserRole.ADMIN,
      } as User;

      service.deleteQuestion.mockResolvedValue(true);

      const result = await resolver.deleteQuestion(mockAdmin, 'q2');

      expect(service.deleteQuestion).toHaveBeenCalledWith(
        'admin-1',
        UserRole.ADMIN,
        'q2',
      );
      expect(result).toBe(true);
    });
  });
});

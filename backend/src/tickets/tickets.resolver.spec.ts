import { Test, TestingModule } from '@nestjs/testing';
import { TicketsResolver } from './tickets.resolver';
import { TicketsService } from './tickets.service';
import { UserRole, MpConnectStatus, KycStatus } from '@prisma/client';

describe('TicketsResolver', () => {
  let resolver: TicketsResolver;
  let ticketsService: any;

  const mockTicketsService = {
    buyTickets: jest.fn(),
    findByUser: jest.fn(),
    findOne: jest.fn(),
  };

  const createTestUser = (overrides = {}) => ({
    id: 'user-1',
    email: 'test@example.com',
    nombre: 'Test',
    apellido: 'User',
    role: UserRole.USER,
    emailVerified: true,
    mpConnectStatus: MpConnectStatus.NOT_CONNECTED,
    kycStatus: KycStatus.NOT_SUBMITTED,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDeleted: false,
    ...overrides,
  });

  const createTestTicket = (overrides = {}) => ({
    id: 'ticket-1',
    numeroTicket: 1,
    raffleId: 'raffle-1',
    userId: 'user-1',
    precioPagado: 100,
    estado: 'PAGADO',
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsResolver,
        { provide: TicketsService, useValue: mockTicketsService },
      ],
    }).compile();

    resolver = module.get<TicketsResolver>(TicketsResolver);
    ticketsService = module.get(TicketsService);
  });

  describe('buyTickets', () => {
    it('should purchase tickets and return result with payment URL', async () => {
      const user = createTestUser();
      const raffleId = 'raffle-1';
      const cantidad = 3;

      const buyResult = {
        tickets: [
          createTestTicket({ numeroTicket: 1 }),
          createTestTicket({ numeroTicket: 2 }),
          createTestTicket({ numeroTicket: 3 }),
        ],
        paymentUrl: 'https://mercadopago.com/checkout/v1/redirect?pref_id=123',
        totalAmount: 300,
      };

      ticketsService.buyTickets.mockResolvedValue(buyResult);

      const result = await resolver.buyTickets(user, raffleId, cantidad);

      expect(result).toEqual(buyResult);
      expect(ticketsService.buyTickets).toHaveBeenCalledWith(
        user.id,
        raffleId,
        cantidad,
      );
    });

    it('should handle single ticket purchase', async () => {
      const user = createTestUser();
      const raffleId = 'raffle-1';

      const buyResult = {
        tickets: [createTestTicket()],
        paymentUrl: 'https://mercadopago.com/checkout/v1/redirect?pref_id=456',
        totalAmount: 100,
      };

      ticketsService.buyTickets.mockResolvedValue(buyResult);

      const result = await resolver.buyTickets(user, raffleId, 1);

      expect(result.tickets).toHaveLength(1);
      expect(result.totalAmount).toBe(100);
      expect(ticketsService.buyTickets).toHaveBeenCalledWith(
        user.id,
        raffleId,
        1,
      );
    });

    it('should handle multiple ticket purchase', async () => {
      const user = createTestUser();
      const raffleId = 'raffle-1';
      const cantidad = 10;

      const buyResult = {
        tickets: Array.from({ length: 10 }, (_, i) =>
          createTestTicket({ numeroTicket: i + 1 }),
        ),
        paymentUrl: 'https://mercadopago.com/checkout/v1/redirect?pref_id=789',
        totalAmount: 1000,
      };

      ticketsService.buyTickets.mockResolvedValue(buyResult);

      const result = await resolver.buyTickets(user, raffleId, cantidad);

      expect(result.tickets).toHaveLength(10);
      expect(result.totalAmount).toBe(1000);
    });

    it('should use current user ID from auth context', async () => {
      const user = createTestUser({ id: 'specific-user-id' });

      ticketsService.buyTickets.mockResolvedValue({
        tickets: [],
        paymentUrl: 'https://example.com',
        totalAmount: 0,
      });

      await resolver.buyTickets(user, 'raffle-1', 1);

      expect(ticketsService.buyTickets).toHaveBeenCalledWith(
        'specific-user-id',
        expect.any(String),
        expect.any(Number),
      );
    });
  });

  describe('myTickets', () => {
    it('should return all tickets for current user', async () => {
      const user = createTestUser();
      const tickets = [
        createTestTicket({ id: 'ticket-1', numeroTicket: 1 }),
        createTestTicket({ id: 'ticket-2', numeroTicket: 2 }),
        createTestTicket({ id: 'ticket-3', numeroTicket: 3 }),
      ];

      ticketsService.findByUser.mockResolvedValue(tickets);

      const result = await resolver.myTickets(user);

      expect(result).toEqual(tickets);
      expect(result).toHaveLength(3);
      expect(ticketsService.findByUser).toHaveBeenCalledWith(user.id);
    });

    it('should return empty array when user has no tickets', async () => {
      const user = createTestUser();

      ticketsService.findByUser.mockResolvedValue([]);

      const result = await resolver.myTickets(user);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should call service with correct user ID', async () => {
      const user = createTestUser({ id: 'custom-user-id' });

      ticketsService.findByUser.mockResolvedValue([]);

      await resolver.myTickets(user);

      expect(ticketsService.findByUser).toHaveBeenCalledWith('custom-user-id');
    });
  });

  describe('ticket', () => {
    it('should return ticket by ID', async () => {
      const user = createTestUser();
      const ticket = createTestTicket({ id: 'ticket-123' });

      ticketsService.findOne.mockResolvedValue(ticket);

      const result = await resolver.ticket('ticket-123');

      expect(result).toEqual(ticket);
      expect(ticketsService.findOne).toHaveBeenCalledWith('ticket-123');
    });

    it('should return ticket with all properties', async () => {
      const user = createTestUser();
      const ticket = createTestTicket({
        id: 'ticket-456',
        numeroTicket: 42,
        precioPagado: 250,
        estado: 'PAGADO',
      });

      ticketsService.findOne.mockResolvedValue(ticket);

      const result = await resolver.ticket('ticket-456');

      expect(result.id).toBe('ticket-456');
      expect(result.numeroTicket).toBe(42);
      expect(result.precioPagado).toBe(250);
      expect(result.estado).toBe('PAGADO');
    });

    it('should call service with correct ticket ID', async () => {
      ticketsService.findOne.mockResolvedValue(createTestTicket());

      await resolver.ticket('specific-ticket-id');

      expect(ticketsService.findOne).toHaveBeenCalledWith('specific-ticket-id');
    });
  });
});

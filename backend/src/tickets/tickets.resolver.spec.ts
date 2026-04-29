import { Test, TestingModule } from '@nestjs/testing';
import { TicketsResolver } from './tickets.resolver';
import { TicketsService } from './tickets.service';
import {
  UserRole,
  SellerPaymentAccountStatus,
  KycStatus,
} from '@prisma/client';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';

describe('TicketsResolver', () => {
  let resolver: TicketsResolver;
  let ticketsService: any;

  const mockTicketsService = {
    buyTickets: jest.fn(),
    buySelectedTickets: jest.fn(),
    getTicketNumberAvailability: jest.fn(),
    getUserTicketCount: jest.fn(),
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
    twoFactorEnabled: false,
    twoFactorEnabledAt: null,
    sellerPaymentAccountStatus: SellerPaymentAccountStatus.NOT_CONNECTED,
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
        undefined,
        undefined,
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
        undefined,
        undefined,
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
        paidWithCredit: true,
        creditDebited: 0,
        creditBalanceAfter: 0,
        totalAmount: 0,
        grossSubtotal: 0,
        discountApplied: 0,
        chargedAmount: 0,
        cantidadComprada: 0,
        baseQuantity: 0,
        bonusQuantity: 0,
        grantedQuantity: 0,
        packApplied: false,
        ticketsRestantesQuePuedeComprar: 0,
      });

      await resolver.buyTickets(user, 'raffle-1', 1);

      expect(ticketsService.buyTickets).toHaveBeenCalledWith(
        'specific-user-id',
        expect.any(String),
        expect.any(Number),
        undefined,
        undefined,
      );
    });
  });

  describe('buySelectedTickets', () => {
    it('should purchase the requested numbers through the selected-number flow', async () => {
      const user = createTestUser();
      const resultPayload = {
        tickets: [
          createTestTicket({ numeroTicket: 7 }),
          createTestTicket({ numeroTicket: 11 }),
        ],
        paidWithCredit: true,
        creditDebited: 210,
        creditBalanceAfter: 790,
        totalAmount: 210,
        grossSubtotal: 200,
        discountApplied: 0,
        chargedAmount: 210,
        cantidadComprada: 2,
        baseQuantity: 2,
        bonusQuantity: 0,
        grantedQuantity: 2,
        packApplied: false,
        packIneligibilityReason: undefined,
        ticketsRestantesQuePuedeComprar: 48,
        purchaseMode: 'CHOOSE_NUMBERS',
        selectionPremiumPercent: 5,
        selectionPremiumAmount: 10,
      };

      ticketsService.buySelectedTickets.mockResolvedValue(resultPayload);

      const result = await resolver.buySelectedTickets(
        user,
        'raffle-1',
        [7, 11],
      );

      expect(result).toEqual(resultPayload);
      expect(ticketsService.buySelectedTickets).toHaveBeenCalledWith(
        user.id,
        'raffle-1',
        [7, 11],
        undefined,
        undefined,
      );
    });
  });

  describe('ticketNumberAvailability', () => {
    it('should return paginated number availability for a raffle', async () => {
      const availabilityResult = {
        items: [
          { number: 1, isAvailable: false },
          { number: 2, isAvailable: true },
        ],
        totalTickets: 100,
        page: 1,
        pageSize: 2,
        totalPages: 50,
        availableCount: 99,
        maxSelectable: 50,
        premiumPercent: 5,
      };

      ticketsService.getTicketNumberAvailability.mockResolvedValue(
        availabilityResult,
      );

      const result = await resolver.ticketNumberAvailability('raffle-1', 1, 2);

      expect(result).toEqual(availabilityResult);
      expect(ticketsService.getTicketNumberAvailability).toHaveBeenCalledWith(
        'raffle-1',
        1,
        2,
        undefined,
      );
    });

    it('should be publicly accessible for unauthenticated visitors', () => {
      expect(
        Reflect.getMetadata(IS_PUBLIC_KEY, resolver.ticketNumberAvailability),
      ).toBe(true);
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

  describe('myTicketCountInRaffle', () => {
    it('should return the current user ticket count for the raffle', async () => {
      const user = createTestUser();
      ticketsService.getUserTicketCount.mockResolvedValue(4);

      const result = await resolver.myTicketCountInRaffle(user, 'raffle-1');

      expect(result).toBe(4);
      expect(ticketsService.getUserTicketCount).toHaveBeenCalledWith(
        user.id,
        'raffle-1',
      );
    });
  });

  describe('ticket', () => {
    it('should return ticket by ID', async () => {
      const user = createTestUser();
      const ticket = createTestTicket({ id: 'ticket-123' });

      ticketsService.findOne.mockResolvedValue(ticket);

      const result = await resolver.ticket(user, 'ticket-123');

      expect(result).toEqual(ticket);
      expect(ticketsService.findOne).toHaveBeenCalledWith(
        'ticket-123',
        user.id,
        user.role,
      );
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

      const result = await resolver.ticket(user, 'ticket-456');

      expect(result.id).toBe('ticket-456');
      expect(result.numeroTicket).toBe(42);
      expect(result.precioPagado).toBe(250);
      expect(result.estado).toBe('PAGADO');
    });

    it('should call service with correct ticket ID', async () => {
      const user = createTestUser({ id: 'specific-user-id' });
      ticketsService.findOne.mockResolvedValue(createTestTicket());

      await resolver.ticket(user, 'specific-ticket-id');

      expect(ticketsService.findOne).toHaveBeenCalledWith(
        'specific-ticket-id',
        'specific-user-id',
        user.role,
      );
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketsRepository } from './tickets.repository';
import { TicketStatus } from '@prisma/client';

describe('TicketsRepository', () => {
  let repository: TicketsRepository;
  let mockPrismaService: any;

  const createMockTicket = (overrides: Partial<any> = {}): any => ({
    id: 'ticket-id-123',
    numeroTicket: 1,
    estado: TicketStatus.RESERVADO,
    raffleId: 'raffle-id-123',
    buyerId: 'buyer-id-123',
    purchaseReference: 'ref-123',
    precioPagado: 100,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    paidAt: null,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  });

  const mockTicket = createMockTicket();

  const mockBuyer = {
    id: 'buyer-id-123',
    email: 'buyer@example.com',
    nombre: 'Test',
    apellido: 'Buyer',
  };

  const mockRaffle = {
    id: 'raffle-id-123',
    titulo: 'Test Raffle',
    estado: 'ACTIVA',
    product: {
      id: 'product-id-123',
      nombre: 'Test Product',
      imagenes: ['image.jpg'],
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrismaService = {
      ticket: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repository = module.get<TicketsRepository>(TicketsRepository);
  });

  describe('BaseRepository methods', () => {
    describe('findById', () => {
      it('should find ticket by ID', async () => {
        mockPrismaService.ticket.findUnique.mockResolvedValue(mockTicket);

        const result = await repository.findById('ticket-id-123');

        expect(result).toEqual(mockTicket);
        expect(mockPrismaService.ticket.findUnique).toHaveBeenCalledWith({
          where: { id: 'ticket-id-123' },
        });
      });
    });

    describe('create', () => {
      it('should create a new ticket', async () => {
        mockPrismaService.ticket.create.mockResolvedValue(mockTicket);
        const ticketData = {
          raffleId: 'raffle-id-123',
          buyerId: 'buyer-id-123',
          numeroTicket: 1,
          estado: TicketStatus.RESERVADO,
          precioPagado: 100,
        };

        const result = await repository.create(ticketData as any);

        expect(result).toEqual(mockTicket);
        expect(mockPrismaService.ticket.create).toHaveBeenCalledWith({
          data: ticketData,
        });
      });
    });

    describe('update', () => {
      it('should update ticket by ID', async () => {
        const updatedTicket = createMockTicket({ estado: TicketStatus.PAGADO });
        mockPrismaService.ticket.update.mockResolvedValue(updatedTicket);

        const result = await repository.update('ticket-id-123', {
          estado: TicketStatus.PAGADO,
        });

        expect(result.estado).toBe(TicketStatus.PAGADO);
        expect(mockPrismaService.ticket.update).toHaveBeenCalledWith({
          where: { id: 'ticket-id-123' },
          data: { estado: TicketStatus.PAGADO },
        });
      });
    });

    describe('delete', () => {
      it('should delete ticket by ID', async () => {
        mockPrismaService.ticket.delete.mockResolvedValue(mockTicket);

        const result = await repository.delete('ticket-id-123');

        expect(result).toEqual(mockTicket);
        expect(mockPrismaService.ticket.delete).toHaveBeenCalledWith({
          where: { id: 'ticket-id-123' },
        });
      });
    });

    describe('exists', () => {
      it('should return true if ticket exists', async () => {
        mockPrismaService.ticket.count.mockResolvedValue(1);

        const result = await repository.exists({ id: 'ticket-id-123' });

        expect(result).toBe(true);
      });
    });
  });

  describe('findByRaffle', () => {
    it('should find tickets by raffle ID', async () => {
      const tickets = [
        mockTicket,
        createMockTicket({ id: 'ticket-id-456', numeroTicket: 2 }),
      ];
      mockPrismaService.ticket.findMany.mockResolvedValue(tickets);

      const result = await repository.findByRaffle('raffle-id-123');

      expect(result).toEqual(tickets);
      expect(mockPrismaService.ticket.findMany).toHaveBeenCalledWith({
        where: {
          raffleId: 'raffle-id-123',
          estado: undefined,
          isDeleted: false,
        },
        include: { buyer: true },
        orderBy: { numeroTicket: 'asc' },
      });
    });

    it('should filter by status', async () => {
      mockPrismaService.ticket.findMany.mockResolvedValue([mockTicket]);

      await repository.findByRaffle('raffle-id-123', {
        status: TicketStatus.PAGADO,
      });

      expect(mockPrismaService.ticket.findMany).toHaveBeenCalledWith({
        where: {
          raffleId: 'raffle-id-123',
          estado: TicketStatus.PAGADO,
          isDeleted: false,
        },
        include: { buyer: true },
        orderBy: { numeroTicket: 'asc' },
      });
    });

    it('should include deleted when specified', async () => {
      mockPrismaService.ticket.findMany.mockResolvedValue([mockTicket]);

      await repository.findByRaffle('raffle-id-123', { includeDeleted: true });

      expect(mockPrismaService.ticket.findMany).toHaveBeenCalledWith({
        where: {
          raffleId: 'raffle-id-123',
          estado: undefined,
          isDeleted: undefined,
        },
        include: { buyer: true },
        orderBy: { numeroTicket: 'asc' },
      });
    });
  });

  describe('findPaidByRaffle', () => {
    it('should find paid tickets for raffle drawing', async () => {
      const paidTickets = [
        {
          ...mockTicket,
          estado: TicketStatus.PAGADO,
          buyer: mockBuyer,
          raffle: mockRaffle,
        },
        createMockTicket({
          id: 'ticket-2',
          estado: TicketStatus.PAGADO,
          buyer: mockBuyer,
          raffle: mockRaffle,
        }),
      ];
      mockPrismaService.ticket.findMany.mockResolvedValue(paidTickets);

      const result = await repository.findPaidByRaffle('raffle-id-123');

      expect(result).toHaveLength(2);
      expect(result[0].estado).toBe(TicketStatus.PAGADO);
      expect(mockPrismaService.ticket.findMany).toHaveBeenCalledWith({
        where: {
          raffleId: 'raffle-id-123',
          estado: 'PAGADO',
          isDeleted: false,
        },
        include: { buyer: true, raffle: true },
      });
    });

    it('should return empty array if no paid tickets', async () => {
      mockPrismaService.ticket.findMany.mockResolvedValue([]);

      const result = await repository.findPaidByRaffle('raffle-id-123');

      expect(result).toEqual([]);
    });
  });

  describe('findByBuyer', () => {
    it('should find tickets by buyer', async () => {
      const ticketsWithRaffle = [{ ...mockTicket, raffle: mockRaffle }];
      mockPrismaService.ticket.findMany.mockResolvedValue(ticketsWithRaffle);

      const result = await repository.findByBuyer('buyer-id-123');

      expect(result).toEqual(ticketsWithRaffle);
      expect(mockPrismaService.ticket.findMany).toHaveBeenCalledWith({
        where: {
          buyerId: 'buyer-id-123',
          raffleId: undefined,
          estado: undefined,
          isDeleted: false,
        },
        include: { raffle: { include: { product: true } } },
        orderBy: { fechaCompra: 'desc' },
      });
    });

    it('should filter by status and raffle', async () => {
      mockPrismaService.ticket.findMany.mockResolvedValue([mockTicket]);

      await repository.findByBuyer('buyer-id-123', {
        status: TicketStatus.PAGADO,
        raffleId: 'raffle-id-123',
      });

      expect(mockPrismaService.ticket.findMany).toHaveBeenCalledWith({
        where: {
          buyerId: 'buyer-id-123',
          raffleId: 'raffle-id-123',
          estado: TicketStatus.PAGADO,
          isDeleted: false,
        },
        include: { raffle: { include: { product: true } } },
        orderBy: { fechaCompra: 'desc' },
      });
    });
  });

  describe('findByPurchaseReference', () => {
    it('should find ticket by wallet purchase reference', async () => {
      const ticketWithRelations = {
        ...mockTicket,
        buyer: mockBuyer,
        raffle: mockRaffle,
      };
      mockPrismaService.ticket.findFirst.mockResolvedValue(ticketWithRelations);

      const result = await repository.findByPurchaseReference('purchase-123');

      expect(result).toEqual(ticketWithRelations);
      expect(mockPrismaService.ticket.findFirst).toHaveBeenCalledWith({
        where: { purchaseReference: 'purchase-123' },
        include: { buyer: true, raffle: true },
      });
    });

    it('should return null if not found', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(null);

      const result = await repository.findByPurchaseReference('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('countByRaffleAndStatus', () => {
    it('should count tickets by raffle and status', async () => {
      mockPrismaService.ticket.count.mockResolvedValue(10);

      const result = await repository.countByRaffleAndStatus(
        'raffle-id-123',
        TicketStatus.PAGADO,
      );

      expect(result).toBe(10);
      expect(mockPrismaService.ticket.count).toHaveBeenCalledWith({
        where: {
          raffleId: 'raffle-id-123',
          estado: TicketStatus.PAGADO,
          isDeleted: false,
        },
      });
    });

    it('should count all tickets when no status specified', async () => {
      mockPrismaService.ticket.count.mockResolvedValue(50);

      const result = await repository.countByRaffleAndStatus('raffle-id-123');

      expect(result).toBe(50);
      expect(mockPrismaService.ticket.count).toHaveBeenCalledWith({
        where: {
          raffleId: 'raffle-id-123',
          estado: undefined,
          isDeleted: false,
        },
      });
    });
  });

  describe('getTakenNumbers', () => {
    it('should return taken ticket numbers', async () => {
      mockPrismaService.ticket.findMany.mockResolvedValue([
        { numeroTicket: 1 },
        { numeroTicket: 5 },
        { numeroTicket: 10 },
      ]);

      const result = await repository.getTakenNumbers('raffle-id-123');

      expect(result).toEqual([1, 5, 10]);
      expect(mockPrismaService.ticket.findMany).toHaveBeenCalledWith({
        where: {
          raffleId: 'raffle-id-123',
          estado: { in: ['RESERVADO', 'PAGADO'] },
          isDeleted: false,
        },
        select: { numeroTicket: true },
      });
    });

    it('should return empty array if no tickets', async () => {
      mockPrismaService.ticket.findMany.mockResolvedValue([]);

      const result = await repository.getTakenNumbers('raffle-id-123');

      expect(result).toEqual([]);
    });
  });

  describe('createMany', () => {
    it('should create multiple tickets', async () => {
      const ticketNumbers = [1, 2, 3];
      const createdTickets = ticketNumbers.map((num) =>
        createMockTicket({ numeroTicket: num }),
      );
      mockPrismaService.ticket.createMany.mockResolvedValue({ count: 3 });
      mockPrismaService.ticket.findMany.mockResolvedValue(createdTickets);

      const result = await repository.createMany(
        'raffle-id-123',
        'buyer-id-123',
        ticketNumbers,
        100,
        'ref-123',
      );

      expect(result).toHaveLength(3);
      expect(mockPrismaService.ticket.createMany).toHaveBeenCalledWith({
        data: [
          {
            raffleId: 'raffle-id-123',
            buyerId: 'buyer-id-123',
            numeroTicket: 1,
            precioPagado: 100,
            estado: 'RESERVADO',
            purchaseReference: 'ref-123',
          },
          {
            raffleId: 'raffle-id-123',
            buyerId: 'buyer-id-123',
            numeroTicket: 2,
            precioPagado: 100,
            estado: 'RESERVADO',
            purchaseReference: 'ref-123',
          },
          {
            raffleId: 'raffle-id-123',
            buyerId: 'buyer-id-123',
            numeroTicket: 3,
            precioPagado: 100,
            estado: 'RESERVADO',
            purchaseReference: 'ref-123',
          },
        ],
      });
    });

    it('should work without external reference', async () => {
      mockPrismaService.ticket.createMany.mockResolvedValue({ count: 1 });
      mockPrismaService.ticket.findMany.mockResolvedValue([mockTicket]);

      await repository.createMany('raffle-id-123', 'buyer-id-123', [1], 100);

      const createCall = mockPrismaService.ticket.createMany.mock.calls[0];
      expect(createCall[0].data[0].purchaseReference).toBeUndefined();
    });
  });

  describe('updateStatusByPurchaseReference', () => {
    it('should update status by purchase reference', async () => {
      mockPrismaService.ticket.updateMany.mockResolvedValue({ count: 5 });

      const result = await repository.updateStatusByPurchaseReference(
        'ref-123',
        TicketStatus.PAGADO,
      );

      expect(result).toBe(5);
      expect(mockPrismaService.ticket.updateMany).toHaveBeenCalledWith({
        where: { purchaseReference: 'ref-123' },
        data: {
          estado: TicketStatus.PAGADO,
        },
      });
    });

    it('should update refunded status by purchase reference', async () => {
      mockPrismaService.ticket.updateMany.mockResolvedValue({ count: 3 });

      const result = await repository.updateStatusByPurchaseReference(
        'ref-123',
        TicketStatus.REEMBOLSADO,
      );

      expect(result).toBe(3);
      expect(mockPrismaService.ticket.updateMany).toHaveBeenCalledWith({
        where: { purchaseReference: 'ref-123' },
        data: {
          estado: TicketStatus.REEMBOLSADO,
        },
      });
    });
  });

  describe('markAsRefunded', () => {
    it('should mark tickets as refunded', async () => {
      mockPrismaService.ticket.updateMany.mockResolvedValue({ count: 3 });

      const result = await repository.markAsRefunded([
        'ticket-1',
        'ticket-2',
        'ticket-3',
      ]);

      expect(result).toBe(3);
      expect(mockPrismaService.ticket.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['ticket-1', 'ticket-2', 'ticket-3'] } },
        data: { estado: 'REEMBOLSADO' },
      });
    });

    it('should handle empty array', async () => {
      mockPrismaService.ticket.updateMany.mockResolvedValue({ count: 0 });

      const result = await repository.markAsRefunded([]);

      expect(result).toBe(0);
    });
  });

  describe('getBuyerTicketCount', () => {
    it('should count buyer tickets for raffle', async () => {
      mockPrismaService.ticket.count.mockResolvedValue(5);

      const result = await repository.getBuyerTicketCount(
        'raffle-id-123',
        'buyer-id-123',
      );

      expect(result).toBe(5);
      expect(mockPrismaService.ticket.count).toHaveBeenCalledWith({
        where: {
          raffleId: 'raffle-id-123',
          buyerId: 'buyer-id-123',
          estado: { in: ['RESERVADO', 'PAGADO'] },
          isDeleted: false,
        },
      });
    });
  });

  describe('getAvailableNumbers', () => {
    it('should return available ticket numbers', async () => {
      mockPrismaService.ticket.findMany.mockResolvedValue([
        { numeroTicket: 2 },
        { numeroTicket: 5 },
        { numeroTicket: 8 },
      ]);

      const result = await repository.getAvailableNumbers('raffle-id-123', 10);

      expect(result).toEqual([1, 3, 4, 6, 7, 9, 10]);
    });

    it('should return all numbers if none taken', async () => {
      mockPrismaService.ticket.findMany.mockResolvedValue([]);

      const result = await repository.getAvailableNumbers('raffle-id-123', 5);

      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should return empty array if all taken', async () => {
      mockPrismaService.ticket.findMany.mockResolvedValue([
        { numeroTicket: 1 },
        { numeroTicket: 2 },
        { numeroTicket: 3 },
      ]);

      const result = await repository.getAvailableNumbers('raffle-id-123', 3);

      expect(result).toEqual([]);
    });
  });

  describe('softDeleteByRaffle', () => {
    it('should soft delete all tickets for raffle', async () => {
      mockPrismaService.ticket.updateMany.mockResolvedValue({ count: 50 });

      const result = await repository.softDeleteByRaffle('raffle-id-123');

      expect(result).toBe(50);
      expect(mockPrismaService.ticket.updateMany).toHaveBeenCalledWith({
        where: { raffleId: 'raffle-id-123' },
        data: {
          isDeleted: true,
          deletedAt: expect.any(Date),
        },
      });
    });

    it('should return 0 if no tickets', async () => {
      mockPrismaService.ticket.updateMany.mockResolvedValue({ count: 0 });

      const result = await repository.softDeleteByRaffle('empty-raffle');

      expect(result).toBe(0);
    });
  });
});

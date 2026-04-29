import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { RafflesRepository } from './raffles.repository';
import { RaffleStatus, DeliveryStatus, TicketStatus } from '@prisma/client';

describe('RafflesRepository', () => {
  let repository: RafflesRepository;
  let mockPrismaService: any;

  const createMockRaffle = (overrides: Partial<any> = {}): any => ({
    id: 'raffle-id-123',
    titulo: 'Test Raffle',
    descripcion: 'A test raffle description',
    estado: RaffleStatus.ACTIVA,
    cantidadTickets: 100,
    ticketsVendidos: 50,
    precioPorTicket: 100,
    sellerId: 'seller-id-123',
    winnerId: null,
    productId: 'product-id-123',
    categoryId: 'category-id-123',
    viewCount: 0,
    fechaLimiteSorteo: new Date('2024-12-31'),
    fechaSorteoReal: null,
    isHidden: false,
    hiddenReason: null,
    isDeleted: false,
    deletedAt: null,
    deliveryStatus: null,
    trackingNumber: null,
    shippedAt: null,
    deliveredAt: null,
    confirmedAt: null,
    paymentReleasedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

  const mockRaffle = createMockRaffle();

  const mockProduct = {
    id: 'product-id-123',
    nombre: 'Test Product',
    descripcionDetallada: 'A test product',
    imagenes: ['image1.jpg', 'image2.jpg'],
    categoria: 'Electronics',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockSeller = {
    id: 'seller-id-123',
    email: 'seller@example.com',
    nombre: 'Test',
    apellido: 'Seller',
  };

  const mockTicket = {
    id: 'ticket-id-123',
    numeroTicket: 1,
    estado: TicketStatus.PAGADO,
    raffleId: 'raffle-id-123',
    buyerId: 'buyer-id-123',
    providerPaymentId: null,
    purchasePrice: 100,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    paidAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrismaService = {
      raffle: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RafflesRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repository = module.get<RafflesRepository>(RafflesRepository);
  });

  describe('BaseRepository methods', () => {
    describe('findById', () => {
      it('should find raffle by ID', async () => {
        mockPrismaService.raffle.findUnique.mockResolvedValue(mockRaffle);

        const result = await repository.findById('raffle-id-123');

        expect(result).toEqual(mockRaffle);
        expect(mockPrismaService.raffle.findUnique).toHaveBeenCalledWith({
          where: { id: 'raffle-id-123' },
        });
      });
    });

    describe('create', () => {
      it('should create a new raffle', async () => {
        mockPrismaService.raffle.create.mockResolvedValue(mockRaffle);
        const raffleData = {
          titulo: 'Test Raffle',
          descripcion: 'Description',
          cantidadTickets: 100,
          precioPorTicket: 100,
          seller: { connect: { id: 'seller-id-123' } },
          product: { connect: { id: 'product-id-123' } },
          fechaLimiteSorteo: new Date('2024-12-31'),
        };

        const result = await repository.create(raffleData as any);

        expect(result).toEqual(mockRaffle);
        expect(mockPrismaService.raffle.create).toHaveBeenCalledWith({
          data: raffleData,
        });
      });
    });

    describe('update', () => {
      it('should update raffle by ID', async () => {
        const updatedRaffle = createMockRaffle({ titulo: 'Updated Title' });
        mockPrismaService.raffle.update.mockResolvedValue(updatedRaffle);

        const result = await repository.update('raffle-id-123', {
          titulo: 'Updated Title',
        });

        expect(result).toEqual(updatedRaffle);
        expect(mockPrismaService.raffle.update).toHaveBeenCalledWith({
          where: { id: 'raffle-id-123' },
          data: { titulo: 'Updated Title' },
        });
      });
    });

    describe('delete', () => {
      it('should delete raffle by ID', async () => {
        mockPrismaService.raffle.delete.mockResolvedValue(mockRaffle);

        const result = await repository.delete('raffle-id-123');

        expect(result).toEqual(mockRaffle);
        expect(mockPrismaService.raffle.delete).toHaveBeenCalledWith({
          where: { id: 'raffle-id-123' },
        });
      });
    });

    describe('exists', () => {
      it('should return true if raffle exists', async () => {
        mockPrismaService.raffle.count.mockResolvedValue(1);

        const result = await repository.exists({ id: 'raffle-id-123' });

        expect(result).toBe(true);
      });
    });
  });

  describe('findByIdWithRelations', () => {
    it('should find raffle with full relations', async () => {
      const raffleWithRelations = {
        ...mockRaffle,
        product: mockProduct,
        seller: mockSeller,
        tickets: [mockTicket],
        winner: null,
        dispute: null,
        category: null,
      };
      mockPrismaService.raffle.findUnique.mockResolvedValue(
        raffleWithRelations,
      );

      const result = await repository.findByIdWithRelations('raffle-id-123');

      expect(result).toEqual(raffleWithRelations);
      expect(mockPrismaService.raffle.findUnique).toHaveBeenCalledWith({
        where: { id: 'raffle-id-123' },
        include: RafflesRepository.fullInclude,
      });
    });

    it('should return null when raffle not found', async () => {
      mockPrismaService.raffle.findUnique.mockResolvedValue(null);

      const result = await repository.findByIdWithRelations('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('findBySeller', () => {
    it('should find raffles by seller ID', async () => {
      const raffles = [mockRaffle, createMockRaffle({ id: 'raffle-id-456' })];
      mockPrismaService.raffle.findMany.mockResolvedValue(raffles);

      const result = await repository.findBySeller('seller-id-123');

      expect(result).toEqual(raffles);
      expect(mockPrismaService.raffle.findMany).toHaveBeenCalledWith({
        where: {
          sellerId: 'seller-id-123',
          estado: undefined,
          isDeleted: false,
        },
        include: RafflesRepository.defaultInclude,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by status', async () => {
      mockPrismaService.raffle.findMany.mockResolvedValue([mockRaffle]);

      await repository.findBySeller('seller-id-123', {
        status: RaffleStatus.ACTIVA,
      });

      expect(mockPrismaService.raffle.findMany).toHaveBeenCalledWith({
        where: {
          sellerId: 'seller-id-123',
          estado: RaffleStatus.ACTIVA,
          isDeleted: false,
        },
        include: RafflesRepository.defaultInclude,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should include deleted when specified', async () => {
      mockPrismaService.raffle.findMany.mockResolvedValue([mockRaffle]);

      await repository.findBySeller('seller-id-123', { includeDeleted: true });

      expect(mockPrismaService.raffle.findMany).toHaveBeenCalledWith({
        where: {
          sellerId: 'seller-id-123',
          estado: undefined,
          isDeleted: undefined,
        },
        include: RafflesRepository.defaultInclude,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findActive', () => {
    it('should find active raffles', async () => {
      const activeRaffles = [mockRaffle];
      mockPrismaService.raffle.findMany.mockResolvedValue(activeRaffles);

      const result = await repository.findActive();

      expect(result).toEqual(activeRaffles);
      expect(mockPrismaService.raffle.findMany).toHaveBeenCalledWith({
        where: {
          estado: 'ACTIVA',
          isHidden: false,
          isDeleted: false,
          categoryId: undefined,
        },
        include: RafflesRepository.defaultInclude,
        take: undefined,
        skip: undefined,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by category', async () => {
      mockPrismaService.raffle.findMany.mockResolvedValue([mockRaffle]);

      await repository.findActive({ categoryId: 'category-id-123' });

      expect(mockPrismaService.raffle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categoryId: 'category-id-123',
          }),
        }),
      );
    });

    it('should handle pagination', async () => {
      mockPrismaService.raffle.findMany.mockResolvedValue([mockRaffle]);

      await repository.findActive({ limit: 10, offset: 20 });

      expect(mockPrismaService.raffle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        }),
      );
    });
  });

  describe('findExpired', () => {
    it('should find expired active raffles', async () => {
      const expiredRaffle = createMockRaffle({
        fechaLimiteSorteo: new Date('2020-01-01'),
      });
      mockPrismaService.raffle.findMany.mockResolvedValue([expiredRaffle]);

      const result = await repository.findExpired();

      expect(result).toHaveLength(1);
      expect(mockPrismaService.raffle.findMany).toHaveBeenCalledWith({
        where: {
          estado: 'ACTIVA',
          fechaLimiteSorteo: { lte: expect.any(Date) },
          isDeleted: false,
        },
        include: RafflesRepository.fullInclude,
      });
    });
  });

  describe('findCompletedAwaitingDraw', () => {
    it('should find completed raffles awaiting draw', async () => {
      const completedRaffle = createMockRaffle({
        estado: RaffleStatus.COMPLETADA,
      });
      mockPrismaService.raffle.findMany.mockResolvedValue([completedRaffle]);

      const result = await repository.findCompletedAwaitingDraw();

      expect(result).toHaveLength(1);
      expect(result[0].estado).toBe(RaffleStatus.COMPLETADA);
      expect(mockPrismaService.raffle.findMany).toHaveBeenCalledWith({
        where: {
          estado: 'COMPLETADA',
          winnerId: null,
          isDeleted: false,
        },
        include: RafflesRepository.fullInclude,
      });
    });
  });

  describe('updateStatus', () => {
    it('should update raffle status', async () => {
      const updatedRaffle = createMockRaffle({ estado: RaffleStatus.SORTEADA });
      mockPrismaService.raffle.update.mockResolvedValue(updatedRaffle);

      const result = await repository.updateStatus(
        'raffle-id-123',
        RaffleStatus.SORTEADA,
      );

      expect(result.estado).toBe(RaffleStatus.SORTEADA);
      expect(mockPrismaService.raffle.update).toHaveBeenCalledWith({
        where: { id: 'raffle-id-123' },
        data: { estado: RaffleStatus.SORTEADA },
        include: RafflesRepository.defaultInclude,
      });
    });

    it('should handle all status transitions', async () => {
      const statuses = [
        RaffleStatus.ACTIVA,
        RaffleStatus.COMPLETADA,
        RaffleStatus.SORTEADA,
        RaffleStatus.EN_ENTREGA,
        RaffleStatus.FINALIZADA,
        RaffleStatus.CANCELADA,
      ];

      for (const status of statuses) {
        mockPrismaService.raffle.update.mockResolvedValue(
          createMockRaffle({ estado: status }),
        );
        const result = await repository.updateStatus('raffle-id-123', status);
        expect(result.estado).toBe(status);
      }
    });
  });

  describe('setWinner', () => {
    it('should set winner and update status', async () => {
      const winningRaffle = createMockRaffle({
        winnerId: 'winner-id-123',
        estado: RaffleStatus.SORTEADA,
        fechaSorteoReal: new Date(),
      });
      mockPrismaService.raffle.update.mockResolvedValue(winningRaffle);

      const result = await repository.setWinner(
        'raffle-id-123',
        'winner-id-123',
      );

      expect(result.winnerId).toBe('winner-id-123');
      expect(result.estado).toBe(RaffleStatus.SORTEADA);
      expect(result.fechaSorteoReal).toBeInstanceOf(Date);
      expect(mockPrismaService.raffle.update).toHaveBeenCalledWith({
        where: { id: 'raffle-id-123' },
        data: {
          winnerId: 'winner-id-123',
          estado: 'SORTEADA',
          fechaSorteoReal: expect.any(Date),
        },
        include: RafflesRepository.fullInclude,
      });
    });
  });

  describe('updateDeliveryStatus', () => {
    it('should update to SHIPPED status', async () => {
      const shippedRaffle = createMockRaffle({
        deliveryStatus: DeliveryStatus.SHIPPED,
        trackingNumber: 'TRACK123',
        shippedAt: new Date(),
      });
      mockPrismaService.raffle.update.mockResolvedValue(shippedRaffle);

      const result = await repository.updateDeliveryStatus(
        'raffle-id-123',
        DeliveryStatus.SHIPPED,
        { trackingNumber: 'TRACK123' },
      );

      expect(result.deliveryStatus).toBe(DeliveryStatus.SHIPPED);
      expect(result.trackingNumber).toBe('TRACK123');
      expect(mockPrismaService.raffle.update).toHaveBeenCalledWith({
        where: { id: 'raffle-id-123' },
        data: {
          deliveryStatus: DeliveryStatus.SHIPPED,
          trackingNumber: 'TRACK123',
          shippedAt: expect.any(Date),
        },
        include: RafflesRepository.fullInclude,
      });
    });

    it('should update to DELIVERED status', async () => {
      const deliveredRaffle = createMockRaffle({
        deliveryStatus: DeliveryStatus.DELIVERED,
        deliveredAt: new Date(),
      });
      mockPrismaService.raffle.update.mockResolvedValue(deliveredRaffle);

      const result = await repository.updateDeliveryStatus(
        'raffle-id-123',
        DeliveryStatus.DELIVERED,
      );

      expect(result.deliveryStatus).toBe(DeliveryStatus.DELIVERED);
      expect(mockPrismaService.raffle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deliveredAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should update to CONFIRMED and finalize raffle', async () => {
      const confirmedRaffle = createMockRaffle({
        deliveryStatus: DeliveryStatus.CONFIRMED,
        estado: RaffleStatus.FINALIZADA,
        confirmedAt: new Date(),
        paymentReleasedAt: new Date(),
      });
      mockPrismaService.raffle.update.mockResolvedValue(confirmedRaffle);

      const result = await repository.updateDeliveryStatus(
        'raffle-id-123',
        DeliveryStatus.CONFIRMED,
      );

      expect(result.deliveryStatus).toBe(DeliveryStatus.CONFIRMED);
      expect(result.estado).toBe(RaffleStatus.FINALIZADA);
    });
  });

  describe('incrementViewCount', () => {
    it('should increment view count by 1', async () => {
      const viewedRaffle = createMockRaffle({ viewCount: 1 });
      mockPrismaService.raffle.update.mockResolvedValue(viewedRaffle);

      await repository.incrementViewCount('raffle-id-123');

      expect(mockPrismaService.raffle.update).toHaveBeenCalledWith({
        where: { id: 'raffle-id-123' },
        data: { viewCount: { increment: 1 } },
      });
    });
  });

  describe('setHidden', () => {
    it('should hide raffle with reason', async () => {
      const hiddenRaffle = createMockRaffle({
        isHidden: true,
        hiddenReason: 'Inappropriate content',
      });
      mockPrismaService.raffle.update.mockResolvedValue(hiddenRaffle);

      const result = await repository.setHidden(
        'raffle-id-123',
        true,
        'Inappropriate content',
      );

      expect(result.isHidden).toBe(true);
      expect(result.hiddenReason).toBe('Inappropriate content');
    });

    it('should unhide raffle', async () => {
      const visibleRaffle = createMockRaffle({
        isHidden: false,
        hiddenReason: null,
      });
      mockPrismaService.raffle.update.mockResolvedValue(visibleRaffle);

      const result = await repository.setHidden('raffle-id-123', false);

      expect(result.isHidden).toBe(false);
      expect(result.hiddenReason).toBeNull();
    });
  });

  describe('softDelete', () => {
    it('should soft delete raffle', async () => {
      const deletedRaffle = createMockRaffle({
        isDeleted: true,
        deletedAt: new Date(),
      });
      mockPrismaService.raffle.update.mockResolvedValue(deletedRaffle);

      const result = await repository.softDelete('raffle-id-123');

      expect(result.isDeleted).toBe(true);
      expect(result.deletedAt).toBeInstanceOf(Date);
      expect(mockPrismaService.raffle.update).toHaveBeenCalledWith({
        where: { id: 'raffle-id-123' },
        data: {
          isDeleted: true,
          deletedAt: expect.any(Date),
        },
      });
    });
  });

  describe('countByStatus', () => {
    it('should count raffles by all statuses', async () => {
      mockPrismaService.raffle.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(0);

      const result = await repository.countByStatus();

      expect(result.ACTIVA).toBe(5);
      expect(result.COMPLETADA).toBe(3);
      expect(result.SORTEADA).toBe(2);
      expect(result.EN_ENTREGA).toBe(1);
      expect(result.FINALIZADA).toBe(4);
      expect(result.CANCELADA).toBe(0);
      expect(mockPrismaService.raffle.count).toHaveBeenCalledTimes(6);
    });

    it('should count by seller when specified', async () => {
      mockPrismaService.raffle.count.mockResolvedValue(2);

      await repository.countByStatus('seller-id-123');

      expect(mockPrismaService.raffle.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sellerId: 'seller-id-123',
          }),
        }),
      );
    });
  });

  describe('findByParticipant', () => {
    it('should find raffles where user has tickets', async () => {
      const participantRaffles = [mockRaffle];
      mockPrismaService.raffle.findMany.mockResolvedValue(participantRaffles);

      const result = await repository.findByParticipant('buyer-id-123');

      expect(result).toEqual(participantRaffles);
      expect(mockPrismaService.raffle.findMany).toHaveBeenCalledWith({
        where: {
          tickets: {
            some: {
              buyerId: 'buyer-id-123',
              estado: 'PAGADO',
            },
          },
          isDeleted: false,
        },
        include: RafflesRepository.defaultInclude,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findWonByUser', () => {
    it('should find raffles won by user', async () => {
      const wonRaffle = createMockRaffle({
        winnerId: 'winner-id-123',
        fechaSorteoReal: new Date(),
      });
      mockPrismaService.raffle.findMany.mockResolvedValue([wonRaffle]);

      const result = await repository.findWonByUser('winner-id-123');

      expect(result).toHaveLength(1);
      expect(result[0].winnerId).toBe('winner-id-123');
      expect(mockPrismaService.raffle.findMany).toHaveBeenCalledWith({
        where: {
          winnerId: 'winner-id-123',
          isDeleted: false,
        },
        include: RafflesRepository.fullInclude,
        orderBy: { fechaSorteoReal: 'desc' },
      });
    });
  });
});

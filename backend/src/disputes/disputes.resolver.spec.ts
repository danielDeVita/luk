import { Test, TestingModule } from '@nestjs/testing';
import { DisputesResolver } from './disputes.resolver';
import { DisputesService } from './disputes.service';
import {
  UserRole,
  MpConnectStatus,
  KycStatus,
  DisputeType,
  DisputeStatus,
} from '@prisma/client';

describe('DisputesResolver', () => {
  let resolver: DisputesResolver;
  let disputesService: any;

  const mockDisputesService = {
    openDispute: jest.fn(),
    respondDispute: jest.fn(),
    resolveDispute: jest.fn(),
    findAllPending: jest.fn(),
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

  const createTestDispute = (overrides = {}) => ({
    id: 'dispute-1',
    raffleId: 'raffle-1',
    reporterId: 'user-1',
    titulo: 'Product Not Received',
    descripcion: 'Product not received after expected delivery',
    tipo: DisputeType.NO_LLEGO,
    estado: 'ABIERTA',
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputesResolver,
        { provide: DisputesService, useValue: mockDisputesService },
      ],
    }).compile();

    resolver = module.get<DisputesResolver>(DisputesResolver);
    disputesService = module.get(DisputesService);
  });

  describe('openDispute', () => {
    it('should open a new dispute', async () => {
      const user = createTestUser();
      const input = {
        raffleId: 'raffle-1',
        tipo: DisputeType.NO_LLEGO,
        titulo: 'Product Never Arrived',
        descripcion: 'Product not received after 10 days of expected delivery',
      };
      const dispute = createTestDispute(input);

      disputesService.openDispute.mockResolvedValue(dispute);

      const result = await resolver.openDispute(user, input);

      expect(result).toEqual(dispute);
      expect(disputesService.openDispute).toHaveBeenCalledWith(user.id, input);
    });

    it('should create dispute with provided type and reason', async () => {
      const user = createTestUser();
      const input = {
        raffleId: 'raffle-2',
        tipo: DisputeType.DANADO,
        titulo: 'Damaged Product',
        descripcion: 'Item arrived damaged with visible cracks on the screen',
      };

      disputesService.openDispute.mockResolvedValue(createTestDispute());

      await resolver.openDispute(user, input);

      expect(disputesService.openDispute).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({
          tipo: DisputeType.DANADO,
          titulo: 'Damaged Product',
        }),
      );
    });
  });

  describe('respondDispute', () => {
    it('should allow seller to respond to dispute', async () => {
      const user = createTestUser({ id: 'seller-1' });
      const disputeId = 'dispute-1';
      const input = {
        respuesta: 'Product was shipped with tracking number ABC123',
        evidence: ['https://example.com/tracking.jpg'],
      };
      const updatedDispute = createTestDispute({
        respuestaVendedor: input.respuesta,
      });

      disputesService.respondDispute.mockResolvedValue(updatedDispute);

      const result = await resolver.respondDispute(user, disputeId, input);

      expect(result).toEqual(updatedDispute);
      expect(disputesService.respondDispute).toHaveBeenCalledWith(
        user.id,
        disputeId,
        input,
      );
    });

    it('should include evidence when provided', async () => {
      const user = createTestUser();
      const disputeId = 'dispute-2';
      const input = {
        respuesta: 'Here is proof of delivery',
        evidence: [
          'https://example.com/photo1.jpg',
          'https://example.com/photo2.jpg',
        ],
      };

      disputesService.respondDispute.mockResolvedValue(createTestDispute());

      await resolver.respondDispute(user, disputeId, input);

      expect(disputesService.respondDispute).toHaveBeenCalledWith(
        user.id,
        disputeId,
        expect.objectContaining({
          evidence: [
            'https://example.com/photo1.jpg',
            'https://example.com/photo2.jpg',
          ],
        }),
      );
    });
  });

  describe('resolveDispute', () => {
    it('should allow admin to resolve dispute', async () => {
      const admin = createTestUser({ id: 'admin-1', role: UserRole.ADMIN });
      const disputeId = 'dispute-1';
      const input = {
        decision: DisputeStatus.RESUELTA_COMPRADOR,
        resolucion: 'Seller failed to provide evidence',
      };
      const resolvedDispute = createTestDispute({
        status: 'RESUELTA_COMPRADOR',
      });

      disputesService.resolveDispute.mockResolvedValue(resolvedDispute);

      const result = await resolver.resolveDispute(admin, disputeId, input);

      expect(result).toEqual(resolvedDispute);
      expect(disputesService.resolveDispute).toHaveBeenCalledWith(
        admin.id,
        disputeId,
        input,
      );
    });

    it('should throw error when non-admin tries to resolve', async () => {
      const user = createTestUser({ role: UserRole.USER });
      const disputeId = 'dispute-1';
      const input = {
        decision: DisputeStatus.RESUELTA_COMPRADOR,
        resolucion: 'Notes that meet minimum length requirement here',
      };

      let thrownError: Error | null = null;
      try {
        await resolver.resolveDispute(user, disputeId, input);
      } catch (e) {
        thrownError = e as Error;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError?.message).toBe('Unauthorized');
      expect(disputesService.resolveDispute).not.toHaveBeenCalled();
    });

    it('should support partial resolution', async () => {
      const admin = createTestUser({ role: UserRole.ADMIN });
      const disputeId = 'dispute-3';
      const input = {
        decision: DisputeStatus.RESUELTA_PARCIAL,
        resolucion: 'Split 50/50 - both parties partially responsible',
        montoReembolsado: 50,
        montoPagado: 50,
      };

      disputesService.resolveDispute.mockResolvedValue(
        createTestDispute({ status: 'RESUELTA_PARCIAL' }),
      );

      await resolver.resolveDispute(admin, disputeId, input);

      expect(disputesService.resolveDispute).toHaveBeenCalledWith(
        admin.id,
        disputeId,
        expect.objectContaining({
          montoReembolsado: 50,
          montoPagado: 50,
        }),
      );
    });
  });

  describe('pendingDisputes', () => {
    it('should return all pending disputes for admin', async () => {
      const admin = createTestUser({ role: UserRole.ADMIN });
      const disputes = [
        createTestDispute({ id: 'dispute-1', estado: 'ABIERTA' }),
        createTestDispute({
          id: 'dispute-2',
          estado: 'ESPERANDO_RESPUESTA_VENDEDOR',
        }),
      ];

      disputesService.findAllPending.mockResolvedValue(disputes);

      const result = await resolver.pendingDisputes(admin);

      expect(result).toEqual(disputes);
      expect(result).toHaveLength(2);
      expect(disputesService.findAllPending).toHaveBeenCalled();
    });

    it('should throw error when non-admin tries to access', async () => {
      const user = createTestUser({ role: UserRole.USER });

      let thrownError: Error | null = null;
      try {
        await resolver.pendingDisputes(user);
      } catch (e) {
        thrownError = e as Error;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError?.message).toBe('Unauthorized');
      expect(disputesService.findAllPending).not.toHaveBeenCalled();
    });
  });

  describe('myDisputes', () => {
    it('should return disputes for current user', async () => {
      const user = createTestUser();
      const disputes = [
        createTestDispute({ id: 'dispute-1', reporterId: user.id }),
        createTestDispute({ id: 'dispute-2', reporterId: user.id }),
      ];

      disputesService.findByUser.mockResolvedValue(disputes);

      const result = await resolver.myDisputes(user);

      expect(result).toEqual(disputes);
      expect(disputesService.findByUser).toHaveBeenCalledWith(user.id);
    });

    it('should return empty array when user has no disputes', async () => {
      const user = createTestUser();

      disputesService.findByUser.mockResolvedValue([]);

      const result = await resolver.myDisputes(user);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('dispute', () => {
    it('should return dispute by ID', async () => {
      const disputeId = 'dispute-123';
      const dispute = createTestDispute({ id: disputeId });

      disputesService.findOne.mockResolvedValue(dispute);

      const result = await resolver.dispute(disputeId);

      expect(result).toEqual(dispute);
      expect(disputesService.findOne).toHaveBeenCalledWith(disputeId);
    });

    it('should return dispute with all details', async () => {
      const dispute = createTestDispute({
        id: 'dispute-456',
        titulo: 'Wrong Product',
        descripcion: 'Detailed issue description about receiving wrong product',
        tipo: DisputeType.DIFERENTE,
      });

      disputesService.findOne.mockResolvedValue(dispute);

      const result = await resolver.dispute('dispute-456');

      expect(result.titulo).toBe('Wrong Product');
      expect(result.descripcion).toBe(
        'Detailed issue description about receiving wrong product',
      );
      expect(result.tipo).toBe(DisputeType.DIFERENTE);
    });
  });
});

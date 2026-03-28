import { Test, TestingModule } from '@nestjs/testing';
import { DisputesService } from './disputes.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { ActivityService } from '../activity/activity.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DisputeType, DisputeStatus, RaffleStatus } from '@prisma/client';
import { RaffleEvents } from '../common/events';

describe('DisputesService', () => {
  let service: DisputesService;
  let prisma: any;
  let paymentsService: any;
  let notifications: any;
  let audit: any;
  let eventEmitter: any;

  const mockPrismaService = () => ({
    raffle: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    dispute: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    userReputation: {
      upsert: jest.fn(),
    },
    ticket: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    transaction: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  });

  const mockPaymentsService = {
    refundPayment: jest.fn(),
  };

  const mockNotificationsService = {
    sendDisputeOpenedToSeller: jest.fn().mockResolvedValue(true),
    sendDisputeOpenedToBuyer: jest.fn().mockResolvedValue(true),
    sendDisputeResolvedNotification: jest.fn().mockResolvedValue(true),
    sendRefundDueToDisputeNotification: jest.fn().mockResolvedValue(true),
    sendDisputeSellerRespondedNotification: jest.fn().mockResolvedValue(true),
    create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
  };

  const mockAuditService = {
    logDisputeResolved: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    logRefundIssued: jest.fn().mockResolvedValue({ id: 'audit-2' }),
  };

  const mockActivityService = {
    logDisputeOpened: jest.fn().mockResolvedValue({ id: 'activity-1' }),
    logDisputeResponded: jest.fn().mockResolvedValue({ id: 'activity-2' }),
    logTicketsRefunded: jest.fn().mockResolvedValue({ id: 'activity-3' }),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  // Test data factories
  const createTestRaffle = (overrides = {}) => ({
    id: 'raffle-1',
    titulo: 'Test Raffle',
    sellerId: 'seller-1',
    winnerId: 'winner-1',
    estado: RaffleStatus.SORTEADA,
    deliveryStatus: null,
    dispute: null,
    seller: {
      id: 'seller-1',
      email: 'seller@test.com',
      nombre: 'Seller',
    },
    winner: {
      id: 'winner-1',
      email: 'winner@test.com',
      nombre: 'Winner',
    },
    tickets: [],
    ...overrides,
  });

  const createTestDispute = (overrides = {}) => ({
    id: 'dispute-1',
    raffleId: 'raffle-1',
    reporterId: 'winner-1',
    tipo: DisputeType.NO_LLEGO,
    titulo: 'Producto no recibido',
    descripcion:
      'Han pasado 2 semanas desde el sorteo y no he recibido el producto.',
    evidencias: ['https://example.com/evidence.jpg'],
    evidenciasVendedor: [],
    estado: DisputeStatus.ABIERTA,
    respuestaVendedor: null,
    resolucion: null,
    montoReembolsado: null,
    montoPagadoVendedor: null,
    adminNotes: null,
    fechaRespuestaVendedor: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    raffle: createTestRaffle(),
    reporter: {
      id: 'winner-1',
      email: 'winner@test.com',
      nombre: 'Winner',
    },
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputesService,
        { provide: PrismaService, useValue: mockPrismaService() },
        { provide: PaymentsService, useValue: mockPaymentsService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: ActivityService, useValue: mockActivityService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<DisputesService>(DisputesService);
    prisma = module.get(PrismaService);
    paymentsService = module.get(PaymentsService);
    notifications = module.get(NotificationsService);
    audit = module.get(AuditService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('openDispute', () => {
    const openDisputeInput = {
      raffleId: 'raffle-1',
      tipo: DisputeType.NO_LLEGO,
      titulo: 'Producto no recibido',
      descripcion:
        'Han pasado 2 semanas desde el sorteo y no he recibido el producto.',
      evidencias: ['https://example.com/evidence.jpg'],
    };

    it('should successfully open a dispute', async () => {
      const raffle = createTestRaffle({ dispute: null });
      const dispute = createTestDispute();

      prisma.raffle.findUnique.mockResolvedValue(raffle);
      prisma.raffle.update.mockResolvedValue({
        ...raffle,
        deliveryStatus: 'DISPUTED',
      });
      prisma.dispute.create.mockResolvedValue(dispute);
      prisma.userReputation.upsert.mockResolvedValue({
        id: 'rep-1',
        userId: 'winner-1',
        disputasComoCompradorAbiertas: 1,
      } as any);

      const result = await service.openDispute('winner-1', openDisputeInput);

      expect(result).toEqual(dispute);
      expect(prisma.raffle.update).toHaveBeenCalledWith({
        where: { id: 'raffle-1' },
        data: { deliveryStatus: 'DISPUTED' },
      });
      expect(prisma.dispute.create).toHaveBeenCalledWith({
        data: {
          raffleId: 'raffle-1',
          reporterId: 'winner-1',
          tipo: DisputeType.NO_LLEGO,
          titulo: 'Producto no recibido',
          descripcion:
            'Han pasado 2 semanas desde el sorteo y no he recibido el producto.',
          evidencias: ['https://example.com/evidence.jpg'],
          estado: 'ABIERTA',
          evidenciasVendedor: [],
        },
        include: { raffle: { include: { seller: true } }, reporter: true },
      });
      expect(prisma.userReputation.upsert).toHaveBeenCalledWith({
        where: { userId: 'winner-1' },
        create: {
          userId: 'winner-1',
          disputasComoCompradorAbiertas: 1,
        },
        update: {
          disputasComoCompradorAbiertas: { increment: 1 },
        },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        RaffleEvents.DISPUTE_OPENED,
        expect.objectContaining({
          disputeId: 'dispute-1',
          raffleId: 'raffle-1',
          reporterId: 'winner-1',
          sellerId: 'seller-1',
          disputeType: 'NO_LLEGO',
        }),
      );
      expect(notifications.sendDisputeOpenedToSeller).toHaveBeenCalledWith(
        'seller@test.com',
        expect.objectContaining({
          raffleName: 'Test Raffle',
          disputeType: 'NO_LLEGO',
        }),
      );
      expect(notifications.sendDisputeOpenedToBuyer).toHaveBeenCalledWith(
        'winner@test.com',
        expect.objectContaining({
          raffleName: 'Test Raffle',
          disputeId: 'dispute-1',
        }),
      );
    });

    it('should throw NotFoundException if raffle does not exist', async () => {
      prisma.raffle.findUnique.mockResolvedValue(null);

      await expect(
        service.openDispute('winner-1', openDisputeInput),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.openDispute('winner-1', openDisputeInput),
      ).rejects.toThrow('Rifa no encontrada');
    });

    it('should throw ForbiddenException if user is not the winner', async () => {
      const raffle = createTestRaffle({ winnerId: 'other-user' });
      prisma.raffle.findUnique.mockResolvedValue(raffle);

      await expect(
        service.openDispute('winner-1', openDisputeInput),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.openDispute('winner-1', openDisputeInput),
      ).rejects.toThrow('Solo el ganador puede abrir una disputa');
    });

    it('should throw BadRequestException if dispute already exists', async () => {
      const raffle = createTestRaffle({ dispute: createTestDispute() });
      prisma.raffle.findUnique.mockResolvedValue(raffle);

      await expect(
        service.openDispute('winner-1', openDisputeInput),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.openDispute('winner-1', openDisputeInput),
      ).rejects.toThrow('Ya existe una disputa para esta rifa');
    });

    it('should throw BadRequestException if raffle is not disputable', async () => {
      const raffle = createTestRaffle({
        estado: RaffleStatus.ACTIVA,
        dispute: null,
      });
      prisma.raffle.findUnique.mockResolvedValue(raffle);

      await expect(
        service.openDispute('winner-1', openDisputeInput),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.openDispute('winner-1', openDisputeInput),
      ).rejects.toThrow('Solo se pueden disputar rifas sorteadas o en entrega');
    });

    it('should allow dispute when raffle is EN_ENTREGA and shipment is pending buyer confirmation', async () => {
      const raffle = createTestRaffle({
        estado: RaffleStatus.EN_ENTREGA,
        deliveryStatus: 'SHIPPED',
        dispute: null,
      });
      const dispute = createTestDispute({
        raffle: {
          ...raffle,
          deliveryStatus: 'DISPUTED',
        },
      });

      prisma.raffle.findUnique.mockResolvedValue(raffle);
      prisma.raffle.update.mockResolvedValue({
        ...raffle,
        deliveryStatus: 'DISPUTED',
      });
      prisma.dispute.create.mockResolvedValue(dispute);
      prisma.userReputation.upsert.mockResolvedValue({} as any);

      const result = await service.openDispute('winner-1', openDisputeInput);

      expect(prisma.raffle.update).toHaveBeenCalledWith({
        where: { id: 'raffle-1' },
        data: { deliveryStatus: 'DISPUTED' },
      });
      expect(result).toBe(dispute);
    });

    it('should freeze payout by updating delivery status to DISPUTED', async () => {
      const raffle = createTestRaffle({ dispute: null });
      const dispute = createTestDispute();

      prisma.raffle.findUnique.mockResolvedValue(raffle);
      prisma.raffle.update.mockResolvedValue({
        ...raffle,
        deliveryStatus: 'DISPUTED',
      });
      prisma.dispute.create.mockResolvedValue(dispute);
      prisma.userReputation.upsert.mockResolvedValue({} as any);

      await service.openDispute('winner-1', openDisputeInput);

      expect(prisma.raffle.update).toHaveBeenCalledWith({
        where: { id: 'raffle-1' },
        data: { deliveryStatus: 'DISPUTED' },
      });
    });
  });

  describe('respondDispute', () => {
    const respondInput = {
      respuesta: 'El producto fue enviado el día 10/01 con tracking #123456',
      evidencias: ['https://example.com/tracking.jpg'],
    };

    it('should successfully respond to a dispute', async () => {
      const dispute = createTestDispute();
      const raffle = createTestRaffle();

      prisma.dispute.findUnique.mockResolvedValue(dispute);
      prisma.raffle.findUnique.mockResolvedValue(raffle);
      prisma.dispute.update.mockResolvedValue({
        ...dispute,
        estado: DisputeStatus.EN_MEDIACION,
        respuestaVendedor: respondInput.respuesta,
        evidenciasVendedor: respondInput.evidencias,
        fechaRespuestaVendedor: expect.any(Date),
      });

      const result = await service.respondDispute(
        'seller-1',
        'dispute-1',
        respondInput,
      );

      expect(result.estado).toBe(DisputeStatus.EN_MEDIACION);
      expect(result.respuestaVendedor).toBe(respondInput.respuesta);
      expect(prisma.dispute.update).toHaveBeenCalledWith({
        where: { id: 'dispute-1' },
        data: {
          respuestaVendedor: respondInput.respuesta,
          evidenciasVendedor: respondInput.evidencias,
          estado: 'EN_MEDIACION',
          fechaRespuestaVendedor: expect.any(Date),
        },
        include: { raffle: { include: { seller: true } }, reporter: true },
      });
    });

    it('should throw ForbiddenException if user is not the seller', async () => {
      const dispute = createTestDispute();
      const raffle = createTestRaffle({ sellerId: 'other-seller' });

      prisma.dispute.findUnique.mockResolvedValue(dispute);
      prisma.raffle.findUnique.mockResolvedValue(raffle);

      await expect(
        service.respondDispute('seller-1', 'dispute-1', respondInput),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.respondDispute('seller-1', 'dispute-1', respondInput),
      ).rejects.toThrow('Solo el vendedor puede responder a la disputa');
    });

    it('should throw BadRequestException if dispute is not in valid state', async () => {
      const dispute = createTestDispute({
        estado: DisputeStatus.RESUELTA_COMPRADOR,
      });
      const raffle = createTestRaffle();

      prisma.dispute.findUnique.mockResolvedValue(dispute);
      prisma.raffle.findUnique.mockResolvedValue(raffle);

      await expect(
        service.respondDispute('seller-1', 'dispute-1', respondInput),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.respondDispute('seller-1', 'dispute-1', respondInput),
      ).rejects.toThrow(
        'La disputa no está en un estado válido para responder',
      );
    });

    it('should allow response if dispute is ESPERANDO_RESPUESTA_VENDEDOR', async () => {
      const dispute = createTestDispute({
        estado: DisputeStatus.ESPERANDO_RESPUESTA_VENDEDOR,
      });
      const raffle = createTestRaffle();

      prisma.dispute.findUnique.mockResolvedValue(dispute);
      prisma.raffle.findUnique.mockResolvedValue(raffle);
      prisma.dispute.update.mockResolvedValue({
        ...dispute,
        estado: DisputeStatus.EN_MEDIACION,
      });

      await service.respondDispute('seller-1', 'dispute-1', respondInput);

      expect(prisma.dispute.update).toHaveBeenCalled();
    });
  });

  describe('resolveDispute', () => {
    const resolveInputBuyer = {
      decision: DisputeStatus.RESUELTA_COMPRADOR,
      resolucion:
        'El vendedor no proporcionó evidencia suficiente. Se reembolsa al comprador.',
      montoReembolsado: 1000,
      montoPagadoVendedor: 0,
      adminNotes: 'Caso cerrado a favor del comprador',
    };

    it('should resolve dispute in favor of buyer (RESUELTA_COMPRADOR)', async () => {
      const dispute = createTestDispute({
        estado: DisputeStatus.EN_MEDIACION,
        raffle: createTestRaffle({
          tickets: [
            {
              id: 'ticket-1',
              estado: 'PAGADO',
              mpPaymentId: 'mp-123',
              buyerId: 'winner-1',
            },
          ],
        }),
      });

      prisma.dispute.findUnique.mockResolvedValue(dispute);
      prisma.ticket.findMany
        .mockResolvedValueOnce([
          {
            precioPagado: 1000,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'ticket-1',
            mpPaymentId: 'mp-123',
            precioPagado: 1000,
          },
        ]);
      prisma.ticket.updateMany.mockResolvedValue({ count: 1 });
      prisma.transaction.findMany.mockResolvedValue([
        {
          id: 'txn-1',
          mpPaymentId: 'mp-123',
          cashChargedAmount: 1000,
        },
      ]);
      prisma.dispute.update.mockResolvedValue({
        ...dispute,
        estado: DisputeStatus.RESUELTA_COMPRADOR,
        resolucion: resolveInputBuyer.resolucion,
        montoReembolsado: resolveInputBuyer.montoReembolsado,
        resolvedAt: expect.any(Date),
      });
      prisma.raffle.update.mockResolvedValue({} as any);
      prisma.userReputation.upsert.mockResolvedValue({} as any);
      paymentsService.refundPayment.mockResolvedValue(true);

      const result = await service.resolveDispute(
        'admin-1',
        'dispute-1',
        resolveInputBuyer,
      );

      expect(result.estado).toBe(DisputeStatus.RESUELTA_COMPRADOR);
      expect(prisma.userReputation.upsert).toHaveBeenCalledWith({
        where: { userId: 'seller-1' },
        create: {
          userId: 'seller-1',
          disputasComoVendedorPerdidas: 1,
        },
        update: {
          disputasComoVendedorPerdidas: { increment: 1 },
        },
      });
      expect(paymentsService.refundPayment).toHaveBeenCalledWith(
        'mp-123',
        undefined,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        RaffleEvents.DISPUTE_RESOLVED,
        expect.objectContaining({
          disputeId: 'dispute-1',
          raffleId: 'raffle-1',
          resolution: DisputeStatus.RESUELTA_COMPRADOR,
          buyerAmount: 1000,
          sellerAmount: 0,
        }),
      );
    });

    it('should use the full charged amount when defaulting a buyer refund', async () => {
      const resolveInputWithoutAmount = {
        decision: DisputeStatus.RESUELTA_COMPRADOR,
        resolucion: 'Se devuelve el total pagado por el comprador.',
        montoReembolsado: undefined,
        montoPagadoVendedor: 0,
        adminNotes: 'Reembolso completo del checkout',
      };

      const dispute = createTestDispute({
        estado: DisputeStatus.EN_MEDIACION,
        raffle: createTestRaffle({
          tickets: [
            {
              id: 'ticket-1',
              estado: 'PAGADO',
              mpPaymentId: 'mp-123',
              buyerId: 'winner-1',
            },
            {
              id: 'ticket-2',
              estado: 'PAGADO',
              mpPaymentId: 'mp-123',
              buyerId: 'winner-1',
            },
          ],
        }),
      });

      prisma.dispute.findUnique.mockResolvedValue(dispute);
      prisma.ticket.findMany
        .mockResolvedValueOnce([
          {
            precioPagado: 500,
            mpPaymentId: 'mp-123',
          },
          {
            precioPagado: 500,
            mpPaymentId: 'mp-123',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'ticket-1',
            mpPaymentId: 'mp-123',
            precioPagado: 500,
          },
          {
            id: 'ticket-2',
            mpPaymentId: 'mp-123',
            precioPagado: 500,
          },
        ]);
      prisma.transaction.findMany.mockResolvedValue([
        {
          id: 'txn-1',
          mpPaymentId: 'mp-123',
          cashChargedAmount: 1050,
        },
      ]);
      prisma.ticket.updateMany.mockResolvedValue({ count: 2 });
      prisma.dispute.update.mockResolvedValue({
        ...dispute,
        estado: DisputeStatus.RESUELTA_COMPRADOR,
        montoReembolsado: 1050,
      });
      prisma.raffle.update.mockResolvedValue({} as any);
      prisma.userReputation.upsert.mockResolvedValue({} as any);
      paymentsService.refundPayment.mockResolvedValue(true);

      const result = await service.resolveDispute(
        'admin-1',
        'dispute-1',
        resolveInputWithoutAmount,
      );

      expect(result.montoReembolsado).toBe(1050);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        RaffleEvents.DISPUTE_RESOLVED,
        expect.objectContaining({
          disputeId: 'dispute-1',
          buyerAmount: 1050,
          sellerAmount: 0,
        }),
      );
    });

    it('should resolve dispute in favor of seller (RESUELTA_VENDEDOR)', async () => {
      const resolveInputSeller = {
        decision: DisputeStatus.RESUELTA_VENDEDOR,
        resolucion:
          'El vendedor proporcionó evidencia de envío. El producto fue entregado.',
        montoReembolsado: 0,
        montoPagadoVendedor: 1000,
        adminNotes: 'Tracking confirmado',
      };

      const dispute = createTestDispute({
        estado: DisputeStatus.EN_MEDIACION,
      });

      prisma.dispute.findUnique.mockResolvedValue(dispute);
      prisma.ticket.findMany.mockResolvedValue([{ precioPagado: 1000 }]);
      prisma.dispute.update.mockResolvedValue({
        ...dispute,
        estado: DisputeStatus.RESUELTA_VENDEDOR,
        resolucion: resolveInputSeller.resolucion,
        montoPagadoVendedor: resolveInputSeller.montoPagadoVendedor,
        resolvedAt: expect.any(Date),
      });
      prisma.raffle.update.mockResolvedValue({} as any);
      prisma.userReputation.upsert.mockResolvedValue({} as any);

      const result = await service.resolveDispute(
        'admin-1',
        'dispute-1',
        resolveInputSeller,
      );

      expect(result.estado).toBe(DisputeStatus.RESUELTA_VENDEDOR);
      expect(prisma.userReputation.upsert).toHaveBeenCalledWith({
        where: { userId: 'seller-1' },
        create: {
          userId: 'seller-1',
          disputasComoVendedorGanadas: 1,
        },
        update: {
          disputasComoVendedorGanadas: { increment: 1 },
        },
      });
      expect(prisma.raffle.update).toHaveBeenCalledWith({
        where: { id: 'raffle-1' },
        data: {
          deliveryStatus: 'CONFIRMED',
          estado: 'FINALIZADA',
        },
      });
      expect(paymentsService.refundPayment).not.toHaveBeenCalled();
    });

    it('should resolve dispute as partial (RESUELTA_PARCIAL)', async () => {
      const resolveInputPartial = {
        decision: DisputeStatus.RESUELTA_PARCIAL,
        resolucion:
          'Ambas partes tienen razón parcial. Se reembolsa 50% al comprador.',
        montoReembolsado: 500,
        montoPagadoVendedor: 500,
        adminNotes: 'Solución parcial',
      };

      const dispute = createTestDispute({
        estado: DisputeStatus.EN_MEDIACION,
        raffle: createTestRaffle({
          tickets: [
            {
              id: 'ticket-1',
              estado: 'PAGADO',
              mpPaymentId: 'mp-123',
              buyerId: 'winner-1',
            },
          ],
        }),
      });

      prisma.dispute.findUnique.mockResolvedValue(dispute);
      prisma.ticket.findMany
        .mockResolvedValueOnce([{ precioPagado: 1000 }])
        .mockResolvedValueOnce([
          {
            id: 'ticket-1',
            mpPaymentId: 'mp-123',
            precioPagado: 1000,
          },
        ]);
      prisma.ticket.updateMany.mockResolvedValue({ count: 0 });
      prisma.transaction.findMany.mockResolvedValue([
        {
          id: 'txn-1',
          mpPaymentId: 'mp-123',
          cashChargedAmount: 1000,
        },
      ]);
      prisma.dispute.update.mockResolvedValue({
        ...dispute,
        estado: DisputeStatus.RESUELTA_PARCIAL,
        resolucion: resolveInputPartial.resolucion,
        montoReembolsado: resolveInputPartial.montoReembolsado,
        montoPagadoVendedor: resolveInputPartial.montoPagadoVendedor,
        resolvedAt: expect.any(Date),
      });
      prisma.raffle.update.mockResolvedValue({} as any);
      paymentsService.refundPayment.mockResolvedValue(true);

      const result = await service.resolveDispute(
        'admin-1',
        'dispute-1',
        resolveInputPartial,
      );

      expect(result.estado).toBe(DisputeStatus.RESUELTA_PARCIAL);
      expect(paymentsService.refundPayment).toHaveBeenCalledWith('mp-123', 500);
    });

    it('should throw BadRequestException for invalid resolution status', async () => {
      const invalidInput = {
        decision: 'INVALID_STATUS' as any,
        resolucion: 'Test resolution',
      };

      const dispute = createTestDispute();
      prisma.dispute.findUnique.mockResolvedValue(dispute);

      await expect(
        service.resolveDispute('admin-1', 'dispute-1', invalidInput),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resolveDispute('admin-1', 'dispute-1', invalidInput),
      ).rejects.toThrow('Estado de resolución inválido');
    });

    it('should send notifications to both parties after resolution', async () => {
      const dispute = createTestDispute({
        estado: DisputeStatus.EN_MEDIACION,
      });

      prisma.dispute.findUnique.mockResolvedValue(dispute);
      prisma.ticket.findMany.mockResolvedValue([{ precioPagado: 1000 }]);
      prisma.dispute.update.mockResolvedValue({
        ...dispute,
        estado: DisputeStatus.RESUELTA_VENDEDOR,
      });
      prisma.raffle.update.mockResolvedValue({} as any);
      prisma.userReputation.upsert.mockResolvedValue({} as any);

      await service.resolveDispute('admin-1', 'dispute-1', {
        decision: DisputeStatus.RESUELTA_VENDEDOR,
        resolucion: 'Test resolution',
      });

      expect(
        notifications.sendDisputeResolvedNotification,
      ).toHaveBeenCalledTimes(2);
      expect(notifications.create).toHaveBeenCalledTimes(2);
      expect(audit.logDisputeResolved).toHaveBeenCalledWith(
        'admin-1',
        'dispute-1',
        'Test resolution',
        expect.any(Object),
      );
    });

    it('should throw when refund fails', async () => {
      const dispute = createTestDispute({
        estado: DisputeStatus.EN_MEDIACION,
        raffle: createTestRaffle({
          tickets: [
            {
              id: 'ticket-1',
              estado: 'PAGADO',
              mpPaymentId: 'mp-123',
              buyerId: 'winner-1',
            },
          ],
        }),
      });

      prisma.dispute.findUnique.mockResolvedValue(dispute);
      prisma.ticket.findMany
        .mockResolvedValueOnce([{ precioPagado: 1000 }])
        .mockResolvedValueOnce([
          {
            id: 'ticket-1',
            mpPaymentId: 'mp-123',
            precioPagado: 1000,
          },
        ]);
      prisma.dispute.update.mockResolvedValue({
        ...dispute,
        estado: DisputeStatus.RESUELTA_COMPRADOR,
      });
      prisma.raffle.update.mockResolvedValue({} as any);
      prisma.userReputation.upsert.mockResolvedValue({} as any);
      paymentsService.refundPayment.mockResolvedValue(false);

      await expect(
        service.resolveDispute('admin-1', 'dispute-1', resolveInputBuyer),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return dispute if found', async () => {
      const dispute = createTestDispute();
      prisma.dispute.findUnique.mockResolvedValue(dispute);

      const result = await service.findOne('dispute-1');

      expect(result).toEqual(dispute);
      expect(prisma.dispute.findUnique).toHaveBeenCalledWith({
        where: { id: 'dispute-1' },
        include: {
          raffle: { include: { seller: true, winner: true } },
          reporter: true,
        },
      });
    });

    it('should throw NotFoundException if dispute not found', async () => {
      prisma.dispute.findUnique.mockResolvedValue(null);

      await expect(service.findOne('dispute-1')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('dispute-1')).rejects.toThrow(
        'Disputa no encontrada',
      );
    });
  });

  describe('findByUser', () => {
    it('should return disputes where user is reporter or seller', async () => {
      const disputes = [createTestDispute(), createTestDispute()];
      prisma.dispute.findMany.mockResolvedValue(disputes);

      const result = await service.findByUser('user-1');

      expect(result).toEqual(disputes);
      expect(prisma.dispute.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ reporterId: 'user-1' }, { raffle: { sellerId: 'user-1' } }],
        },
        include: {
          raffle: { include: { product: true, seller: true, winner: true } },
          reporter: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findAllPending', () => {
    it('should return all pending disputes', async () => {
      const disputes = [
        createTestDispute({ estado: DisputeStatus.ABIERTA }),
        createTestDispute({ estado: DisputeStatus.EN_MEDIACION }),
      ];
      prisma.dispute.findMany.mockResolvedValue(disputes);

      const result = await service.findAllPending();

      expect(result).toEqual(disputes);
      expect(prisma.dispute.findMany).toHaveBeenCalledWith({
        where: {
          estado: {
            in: ['ABIERTA', 'ESPERANDO_RESPUESTA_VENDEDOR', 'EN_MEDIACION'],
          },
        },
        include: {
          raffle: { include: { seller: true, winner: true, product: true } },
          reporter: true,
        },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated disputes without filter', async () => {
      const disputes = [createTestDispute(), createTestDispute()];
      prisma.dispute.findMany.mockResolvedValue(disputes);
      prisma.dispute.count.mockResolvedValue(2);

      const result = await service.findAll(undefined, 1, 10);

      expect(result).toEqual({
        disputes,
        total: 2,
        page: 1,
        limit: 10,
      });
      expect(prisma.dispute.findMany).toHaveBeenCalledWith({
        where: {},
        include: { raffle: true, reporter: true },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return paginated disputes with status filter', async () => {
      const disputes = [createTestDispute({ estado: DisputeStatus.ABIERTA })];
      prisma.dispute.findMany.mockResolvedValue(disputes);
      prisma.dispute.count.mockResolvedValue(1);

      const result = await service.findAll('ABIERTA', 1, 10);

      expect(result).toEqual({
        disputes,
        total: 1,
        page: 1,
        limit: 10,
      });
      expect(prisma.dispute.findMany).toHaveBeenCalledWith({
        where: { estado: DisputeStatus.ABIERTA },
        include: { raffle: true, reporter: true },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should handle pagination correctly', async () => {
      prisma.dispute.findMany.mockResolvedValue([]);
      prisma.dispute.count.mockResolvedValue(25);

      await service.findAll(undefined, 3, 10);

      expect(prisma.dispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (page 3 - 1) * 10
          take: 10,
        }),
      );
    });
  });
});

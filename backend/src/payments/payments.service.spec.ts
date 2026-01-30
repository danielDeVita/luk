import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReferralsService } from '../referrals/referrals.service';

// Mock mercadopago
jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn().mockImplementation(() => ({
    accessToken: 'TEST-access-token',
  })),
  Preference: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
  })),
  Payment: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
  })),
}));

import { Payment } from 'mercadopago';
import type { PaymentResponse } from 'mercadopago/dist/clients/payment/commonTypes';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let _prisma: jest.Mocked<PrismaService>;

  const mockPrismaService = {
    mpEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    ticket: {
      updateMany: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    transaction: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    raffle: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        MP_ACCESS_TOKEN: 'TEST-access-token',
        FRONTEND_URL: 'http://localhost:3000',
        BACKEND_URL: 'http://localhost:3001',
      };
      return config[key];
    }),
  };

  const mockNotificationsService = {
    sendTicketPurchaseConfirmation: jest.fn().mockResolvedValue(true),
    create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
  };

  const mockActivityService = {
    logTicketsPurchased: jest.fn().mockResolvedValue({ id: 'activity-1' }),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockReferralsService = {
    applyReferralReward: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: ActivityService, useValue: mockActivityService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: ReferralsService, useValue: mockReferralsService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('handlePaymentApproved', () => {
    const mockPaymentData = {
      id: '12345678',
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 1000,
      external_reference: JSON.stringify({
        raffleId: 'raffle-123',
        buyerId: 'buyer-456',
        cantidad: 2,
        reservationId: 'res-789',
      }),
      fee_details: [{ amount: 50 }],
      api_response: { status: 200, headers: [] },
    } as unknown as PaymentResponse;

    it('should update tickets to PAGADO on first call', async () => {
      mockPrismaService.ticket.updateMany.mockResolvedValue({ count: 2 });
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      mockPrismaService.transaction.create.mockResolvedValue({ id: 'tx-1' });
      mockPrismaService.raffle.findUnique.mockResolvedValue({
        id: 'raffle-123',
        totalTickets: 10,
        tickets: [{ estado: 'PAGADO' }, { estado: 'PAGADO' }],
      });

      await service.handlePaymentApproved(mockPaymentData);

      expect(mockPrismaService.ticket.updateMany).toHaveBeenCalledWith({
        where: {
          raffleId: 'raffle-123',
          buyerId: 'buyer-456',
          estado: 'RESERVADO',
          mpExternalReference: 'res-789',
        },
        data: {
          estado: 'PAGADO',
          mpPaymentId: '12345678',
          mpExternalReference: 'res-789',
        },
      });
    });

    it('should not create duplicate transaction on second call', async () => {
      mockPrismaService.ticket.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.transaction.findFirst.mockResolvedValue({
        id: 'existing-tx',
      });
      mockPrismaService.raffle.findUnique.mockResolvedValue({
        id: 'raffle-123',
        totalTickets: 10,
        tickets: [{ estado: 'PAGADO' }, { estado: 'PAGADO' }],
      });

      await service.handlePaymentApproved(mockPaymentData);

      expect(mockPrismaService.transaction.create).not.toHaveBeenCalled();
    });

    it('should create transaction record with correct fee calculations', async () => {
      mockPrismaService.ticket.updateMany.mockResolvedValue({ count: 2 });
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      mockPrismaService.transaction.create.mockResolvedValue({ id: 'tx-1' });
      mockPrismaService.raffle.findUnique.mockResolvedValue({
        id: 'raffle-123',
        totalTickets: 10,
        tickets: [],
      });

      await service.handlePaymentApproved(mockPaymentData);

      expect(mockPrismaService.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tipo: 'COMPRA_TICKET',
          userId: 'buyer-456',
          raffleId: 'raffle-123',
          monto: 1000,
          mpPaymentId: '12345678',
          estado: 'COMPLETADO',
        }),
      });
    });

    it('should handle missing external_reference gracefully', async () => {
      const paymentWithoutRef = {
        ...mockPaymentData,
        external_reference: null,
      } as unknown as PaymentResponse;

      await service.handlePaymentApproved(paymentWithoutRef);

      expect(mockPrismaService.ticket.updateMany).not.toHaveBeenCalled();
      expect(mockPrismaService.transaction.create).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON in external_reference gracefully', async () => {
      const paymentWithBadRef = {
        ...mockPaymentData,
        external_reference: 'not-valid-json',
      } as unknown as PaymentResponse;

      await service.handlePaymentApproved(paymentWithBadRef);

      expect(mockPrismaService.ticket.updateMany).not.toHaveBeenCalled();
    });

    it('should mark raffle as COMPLETADA when all tickets are sold', async () => {
      mockPrismaService.ticket.updateMany.mockResolvedValue({ count: 2 });
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      mockPrismaService.transaction.create.mockResolvedValue({ id: 'tx-1' });
      mockPrismaService.raffle.findUnique.mockResolvedValue({
        id: 'raffle-123',
        totalTickets: 10,
        tickets: Array(10).fill({ estado: 'PAGADO' }),
      });
      mockPrismaService.raffle.update.mockResolvedValue({});

      await service.handlePaymentApproved(mockPaymentData);

      expect(mockPrismaService.raffle.update).toHaveBeenCalledWith({
        where: { id: 'raffle-123' },
        data: { estado: 'COMPLETADA' },
      });
    });
  });

  describe('handleMpWebhook', () => {
    beforeEach(() => {
      const mockPaymentGet = jest.fn().mockResolvedValue({
        id: '12345678',
        status: 'approved',
        status_detail: 'accredited',
        transaction_amount: 1000,
        external_reference: JSON.stringify({
          raffleId: 'raffle-123',
          buyerId: 'buyer-456',
          cantidad: 2,
        }),
      });
      (Payment as jest.Mock).mockImplementation(() => ({
        get: mockPaymentGet,
      }));
    });

    it('should ignore non-payment webhook types', async () => {
      await service.handleMpWebhook({
        type: 'merchant_order',
        data: { id: '123' },
      });

      expect(mockPrismaService.mpEvent.findUnique).not.toHaveBeenCalled();
    });

    it('should record MpEvent for idempotency', async () => {
      mockPrismaService.mpEvent.findUnique.mockResolvedValue(null);
      mockPrismaService.mpEvent.create.mockResolvedValue({});
      mockPrismaService.ticket.updateMany.mockResolvedValue({ count: 2 });
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      mockPrismaService.transaction.create.mockResolvedValue({});
      mockPrismaService.raffle.findUnique.mockResolvedValue({
        id: 'raffle-123',
        totalTickets: 10,
        tickets: [],
      });

      await service.handleMpWebhook({
        type: 'payment',
        data: { id: '12345678' },
      });

      expect(mockPrismaService.mpEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventId: '12345678',
          eventType: 'payment.approved',
        }),
      });
    });

    it('should skip processing if event already exists (idempotency)', async () => {
      mockPrismaService.mpEvent.findUnique.mockResolvedValue({
        id: 'existing',
        eventId: '12345678',
      });

      await service.handleMpWebhook({
        type: 'payment',
        data: { id: '12345678' },
      });

      expect(mockPrismaService.ticket.updateMany).not.toHaveBeenCalled();
      expect(mockPrismaService.mpEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('syncPaymentStatus', () => {
    beforeEach(() => {
      const mockPaymentGet = jest.fn().mockResolvedValue({
        id: '12345678',
        status: 'approved',
        status_detail: 'accredited',
        transaction_amount: 1000,
        external_reference: JSON.stringify({
          raffleId: 'raffle-123',
          buyerId: 'buyer-456',
          cantidad: 2,
        }),
      });
      (Payment as jest.Mock).mockImplementation(() => ({
        get: mockPaymentGet,
      }));
    });

    it('should return alreadyProcessed=true if event exists', async () => {
      mockPrismaService.mpEvent.findUnique.mockResolvedValue({
        id: 'existing',
        eventId: '12345678',
      });

      const result = await service.syncPaymentStatus('12345678');

      expect(result).toEqual({
        status: 'approved',
        alreadyProcessed: true,
        ticketsUpdated: 0,
      });
    });

    it('should process payment and return ticketsUpdated count', async () => {
      mockPrismaService.mpEvent.findUnique.mockResolvedValue(null);
      mockPrismaService.mpEvent.create.mockResolvedValue({});
      mockPrismaService.ticket.updateMany.mockResolvedValue({ count: 3 });
      mockPrismaService.ticket.count.mockResolvedValue(3);
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      mockPrismaService.transaction.create.mockResolvedValue({});
      mockPrismaService.raffle.findUnique.mockResolvedValue({
        id: 'raffle-123',
        totalTickets: 10,
        tickets: [],
      });

      const result = await service.syncPaymentStatus('12345678');

      expect(result).toEqual({
        status: 'approved',
        alreadyProcessed: false,
        ticketsUpdated: 3,
      });
    });

    it('should return ticketsUpdated=0 for pending payments', async () => {
      (Payment as jest.Mock).mockImplementation(() => ({
        get: jest.fn().mockResolvedValue({
          id: '12345678',
          status: 'pending',
        }),
      }));

      mockPrismaService.mpEvent.findUnique.mockResolvedValue(null);

      const result = await service.syncPaymentStatus('12345678');

      expect(result).toEqual({
        status: 'pending',
        alreadyProcessed: false,
        ticketsUpdated: 0,
      });
    });
  });

  describe('isEventProcessed', () => {
    it('should return true if event exists', async () => {
      mockPrismaService.mpEvent.findUnique.mockResolvedValue({ id: 'ev-1' });

      const result = await service.isEventProcessed('12345678');

      expect(result).toBe(true);
    });

    it('should return false if event does not exist', async () => {
      mockPrismaService.mpEvent.findUnique.mockResolvedValue(null);

      const result = await service.isEventProcessed('12345678');

      expect(result).toBe(false);
    });
  });

  describe('calculateCommissions', () => {
    it('should calculate platform fee, mp fee, and net amount correctly', () => {
      const result = service.calculateCommissions(1000);

      expect(result.platformFee).toBeCloseTo(40); // 4% platform fee
      expect(result.mpFee).toBeCloseTo(50); // 5% MP fee
      expect(result.netAmount).toBeCloseTo(910);
      expect(result.totalFees).toBeCloseTo(90);
    });
  });

  describe('getMpClient', () => {
    it('should throw BadRequestException when MP is not configured', async () => {
      // Create a new service instance without MP_ACCESS_TOKEN
      const noMpConfigService = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaymentsService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: noMpConfigService },
          { provide: NotificationsService, useValue: mockNotificationsService },
          { provide: ActivityService, useValue: mockActivityService },
          { provide: EventEmitter2, useValue: mockEventEmitter },
          { provide: ReferralsService, useValue: mockReferralsService },
        ],
      }).compile();

      const serviceWithoutMp = module.get<PaymentsService>(PaymentsService);

      await expect(serviceWithoutMp.getPaymentStatus('123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

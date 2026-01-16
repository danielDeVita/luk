import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MpController } from './mp.controller';
import { PaymentsService } from './payments.service';
import { Response } from 'express';
import { HttpStatus } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

describe('MpController', () => {
  let controller: MpController;
  let paymentsService: jest.Mocked<PaymentsService>;

  const mockPaymentsService = {
    handleMpWebhook: jest.fn(),
    syncPaymentStatus: jest.fn(),
    getPaymentStatus: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue(undefined), // No secret configured in tests
  };

  const mockResponse = () => {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 100 }] }),
      ],
      controllers: [MpController],
      providers: [
        { provide: PaymentsService, useValue: mockPaymentsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<MpController>(MpController);
    paymentsService = module.get(PaymentsService);
  });

  describe('POST /mp/webhook', () => {
    it('should parse type-based payload (standard format)', async () => {
      const res = mockResponse();
      const body = {
        type: 'payment',
        data: { id: '12345678' },
      };

      mockPaymentsService.handleMpWebhook.mockResolvedValue(undefined);

      await controller.handleWebhook(body, undefined, undefined, res);

      expect(mockPaymentsService.handleMpWebhook).toHaveBeenCalledWith({
        type: 'payment',
        data: { id: '12345678' },
      });
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    it('should parse topic-based payload (legacy format)', async () => {
      const res = mockResponse();
      const body = {
        topic: 'payment',
        id: '12345678',
      };

      mockPaymentsService.handleMpWebhook.mockResolvedValue(undefined);

      await controller.handleWebhook(body, undefined, undefined, res);

      expect(mockPaymentsService.handleMpWebhook).toHaveBeenCalledWith({
        type: 'payment',
        data: { id: '12345678' },
      });
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    });

    it('should parse action-based payload (webhook v2 format)', async () => {
      const res = mockResponse();
      const body = {
        action: 'payment.created',
        data: { id: '12345678' },
      };

      mockPaymentsService.handleMpWebhook.mockResolvedValue(undefined);

      await controller.handleWebhook(body, undefined, undefined, res);

      expect(mockPaymentsService.handleMpWebhook).toHaveBeenCalledWith({
        type: 'payment',
        data: { id: '12345678' },
      });
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    });

    it('should return 200 even on processing error (MP requirement)', async () => {
      const res = mockResponse();
      const body = {
        type: 'payment',
        data: { id: '12345678' },
      };

      mockPaymentsService.handleMpWebhook.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await controller.handleWebhook(body, undefined, undefined, res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({
        received: true,
        error: 'Database connection failed',
      });
    });

    it('should return 200 with ignored=true for missing event type', async () => {
      const res = mockResponse();
      const body = { some: 'data' };

      await controller.handleWebhook(body, undefined, undefined, res);

      expect(mockPaymentsService.handleMpWebhook).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({ received: true, ignored: true });
    });

    it('should return 200 with ignored=true for missing event id', async () => {
      const res = mockResponse();
      const body = { type: 'payment' };

      await controller.handleWebhook(body, undefined, undefined, res);

      expect(mockPaymentsService.handleMpWebhook).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({ received: true, ignored: true });
    });

    it('should handle empty body gracefully', async () => {
      const res = mockResponse();

      await controller.handleWebhook({}, undefined, undefined, res);

      expect(mockPaymentsService.handleMpWebhook).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    });

    it('should convert numeric id to string', async () => {
      const res = mockResponse();
      const body = {
        type: 'payment',
        data: { id: 12345678 }, // numeric id
      };

      mockPaymentsService.handleMpWebhook.mockResolvedValue(undefined);

      await controller.handleWebhook(body, undefined, undefined, res);

      expect(mockPaymentsService.handleMpWebhook).toHaveBeenCalledWith({
        type: 'payment',
        data: { id: '12345678' }, // should be string
      });
    });
  });

  describe('GET /mp/payment-status', () => {
    it('should return payment status with sync result', async () => {
      const res = mockResponse();

      mockPaymentsService.syncPaymentStatus.mockResolvedValue({
        status: 'approved',
        alreadyProcessed: false,
        ticketsUpdated: 2,
      });
      mockPaymentsService.getPaymentStatus.mockResolvedValue({
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: '{"raffleId":"123"}',
      });

      await controller.getPaymentStatus('12345678', res);

      expect(mockPaymentsService.syncPaymentStatus).toHaveBeenCalledWith('12345678');
      expect(mockPaymentsService.getPaymentStatus).toHaveBeenCalledWith('12345678');
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: '{"raffleId":"123"}',
        syncResult: {
          status: 'approved',
          alreadyProcessed: false,
          ticketsUpdated: 2,
        },
      });
    });

    it('should return 400 if payment_id is missing', async () => {
      const res = mockResponse();

      await controller.getPaymentStatus('', res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({ error: 'payment_id required' });
    });

    it('should return 500 on error', async () => {
      const res = mockResponse();

      mockPaymentsService.syncPaymentStatus.mockRejectedValue(
        new Error('MP API failed'),
      );

      await controller.getPaymentStatus('12345678', res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.json).toHaveBeenCalledWith({ error: 'MP API failed' });
    });
  });

  describe('GET /mp/sync-payment/:paymentId', () => {
    it('should return sync result for valid payment', async () => {
      const res = mockResponse();

      mockPaymentsService.syncPaymentStatus.mockResolvedValue({
        status: 'approved',
        alreadyProcessed: false,
        ticketsUpdated: 3,
      });

      await controller.syncPayment('12345678', res);

      expect(mockPaymentsService.syncPaymentStatus).toHaveBeenCalledWith('12345678');
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({
        status: 'approved',
        alreadyProcessed: false,
        ticketsUpdated: 3,
      });
    });

    it('should return alreadyProcessed=true for duplicate sync', async () => {
      const res = mockResponse();

      mockPaymentsService.syncPaymentStatus.mockResolvedValue({
        status: 'approved',
        alreadyProcessed: true,
        ticketsUpdated: 0,
      });

      await controller.syncPayment('12345678', res);

      expect(res.json).toHaveBeenCalledWith({
        status: 'approved',
        alreadyProcessed: true,
        ticketsUpdated: 0,
      });
    });

    it('should return 400 if paymentId is missing', async () => {
      const res = mockResponse();

      await controller.syncPayment('', res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({ error: 'paymentId required' });
    });

    it('should return 500 with error status on failure', async () => {
      const res = mockResponse();

      mockPaymentsService.syncPaymentStatus.mockRejectedValue(
        new Error('MP API timeout'),
      );

      await controller.syncPayment('12345678', res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.json).toHaveBeenCalledWith({
        error: 'MP API timeout',
        status: 'error',
      });
    });
  });
});

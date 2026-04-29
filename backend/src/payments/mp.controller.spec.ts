import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './mp.controller';
import { PaymentsService } from './payments.service';
import { Response } from 'express';
import { HttpStatus } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let _paymentsService: jest.Mocked<PaymentsService>;

  const mockPaymentsService = {
    handleProviderWebhook: jest.fn(),
    syncPaymentStatus: jest.fn(),
    getPaymentStatus: jest.fn(),
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
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: mockPaymentsService }],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    _paymentsService = module.get(PaymentsService);
  });

  describe('POST /payments/webhook', () => {
    it('should forward provider webhook payloads to the payments service', async () => {
      const res = mockResponse();
      const body = {
        type: 'payment',
        data: { id: '12345678' },
      };

      mockPaymentsService.handleProviderWebhook.mockResolvedValue(undefined);

      await controller.handleWebhook(body, res);

      expect(mockPaymentsService.handleProviderWebhook).toHaveBeenCalledWith(
        body,
      );
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    it('should return 200 even on processing error (provider webhook requirement)', async () => {
      const res = mockResponse();
      const body = {
        type: 'payment',
        data: { id: '12345678' },
      };

      mockPaymentsService.handleProviderWebhook.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await controller.handleWebhook(body, res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({
        received: true,
        error: 'Database connection failed',
      });
    });
  });

  describe('GET /payments/status', () => {
    it('should return payment status with sync result', async () => {
      const res = mockResponse();

      mockPaymentsService.syncPaymentStatus.mockResolvedValue({
        status: 'approved',
        alreadyProcessed: false,
        creditedAmount: 500,
      });
      mockPaymentsService.getPaymentStatus.mockResolvedValue({
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: '{"raffleId":"123"}',
      });

      await controller.getPaymentStatus('12345678', res);

      expect(mockPaymentsService.syncPaymentStatus).toHaveBeenCalledWith(
        '12345678',
      );
      expect(mockPaymentsService.getPaymentStatus).toHaveBeenCalledWith(
        '12345678',
      );
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: '{"raffleId":"123"}',
        syncResult: {
          status: 'approved',
          alreadyProcessed: false,
          creditedAmount: 500,
        },
      });
    });

    it('should return 400 if payment_id is missing', async () => {
      const res = mockResponse();

      await controller.getPaymentStatus('', res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({
        error: 'payment_id required',
      });
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

    it('uses payment_id as the canonical top-up identifier', async () => {
      const res = mockResponse();

      mockPaymentsService.syncPaymentStatus.mockResolvedValue({
        status: 'approved',
        alreadyProcessed: false,
        creditedAmount: 500,
      });
      mockPaymentsService.getPaymentStatus.mockResolvedValue({
        status: 'approved',
        statusDetail: 'paid',
        externalReference: '{"raffleId":"123"}',
        providerOrderId: 'checkout-1',
      });

      await controller.getPaymentStatus('mp-payment-1', res);

      expect(mockPaymentsService.syncPaymentStatus).toHaveBeenCalledWith(
        'mp-payment-1',
      );
      expect(mockPaymentsService.getPaymentStatus).toHaveBeenCalledWith(
        'mp-payment-1',
      );
    });
  });

  describe('GET /payments/sync/:paymentId', () => {
    it('should return sync result for valid payment', async () => {
      const res = mockResponse();

      mockPaymentsService.syncPaymentStatus.mockResolvedValue({
        status: 'approved',
        alreadyProcessed: false,
        creditedAmount: 750,
      });

      await controller.syncPayment('12345678', res);

      expect(mockPaymentsService.syncPaymentStatus).toHaveBeenCalledWith(
        '12345678',
      );
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({
        status: 'approved',
        alreadyProcessed: false,
        creditedAmount: 750,
      });
    });

    it('should return alreadyProcessed=true for duplicate sync', async () => {
      const res = mockResponse();

      mockPaymentsService.syncPaymentStatus.mockResolvedValue({
        status: 'approved',
        alreadyProcessed: true,
        creditedAmount: 0,
      });

      await controller.syncPayment('12345678', res);

      expect(res.json).toHaveBeenCalledWith({
        status: 'approved',
        alreadyProcessed: true,
        creditedAmount: 0,
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

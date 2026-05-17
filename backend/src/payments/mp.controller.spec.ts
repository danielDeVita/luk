import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './mp.controller';
import { PaymentsService } from './payments.service';
import { Request, Response } from 'express';
import { HttpStatus } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let _paymentsService: jest.Mocked<PaymentsService>;

  const mockPaymentsService = {
    startSellerPaymentAccountConnection: jest.fn(),
    completeSellerPaymentAccountConnection: jest.fn(),
    disconnectSellerPaymentAccount: jest.fn(),
    getSellerPaymentAccountStatus: jest.fn(),
    handleProviderWebhook: jest.fn(),
    syncPaymentStatus: jest.fn(),
    getPaymentStatus: jest.fn(),
  };

  const mockRequest = (userId?: string) =>
    ({
      user: userId ? { id: userId } : undefined,
    }) as Request & { user?: { id: string } };

  const mockResponse = () => {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
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

  describe('GET /payments/account', () => {
    it('should redirect authenticated sellers to Mercado Pago OAuth', async () => {
      const req = mockRequest('seller-1');
      const res = mockResponse();
      mockPaymentsService.startSellerPaymentAccountConnection.mockReturnValue(
        'https://auth.mercadopago.com.ar/authorization?state=signed',
      );

      await controller.connectSellerPaymentAccount(req, res);

      expect(
        mockPaymentsService.startSellerPaymentAccountConnection,
      ).toHaveBeenCalledWith('seller-1');
      expect(res.redirect).toHaveBeenCalledWith(
        'https://auth.mercadopago.com.ar/authorization?state=signed',
      );
    });

    it('should reject account connection without an authenticated user', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await controller.connectSellerPaymentAccount(req, res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(res.json).toHaveBeenCalledWith({ error: 'unauthorized' });
    });
  });

  describe('GET /payments/account/callback', () => {
    it('should complete seller OAuth and redirect back to settings', async () => {
      const res = mockResponse();
      mockPaymentsService.completeSellerPaymentAccountConnection.mockResolvedValue(
        { id: 'seller-1' },
      );

      await controller.sellerPaymentAccountCallback(
        'oauth-code',
        'signed-state',
        '',
        res,
      );

      expect(
        mockPaymentsService.completeSellerPaymentAccountConnection,
      ).toHaveBeenCalledWith('oauth-code', 'signed-state');
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/dashboard/settings?tab=payments&mp_account=connected',
      );
    });

    it('should redirect with error when Mercado Pago cancels or errors', async () => {
      const res = mockResponse();

      await controller.sellerPaymentAccountCallback(
        '',
        '',
        'access_denied',
        res,
      );

      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/dashboard/settings?tab=payments&mp_account=error',
      );
    });
  });

  describe('GET /payments/account/status', () => {
    it('should return connected seller payment-account status', async () => {
      const req = mockRequest('seller-1');
      const res = mockResponse();
      const status = {
        status: 'CONNECTED',
        account: { providerAccountId: '123' },
      };
      mockPaymentsService.getSellerPaymentAccountStatus.mockResolvedValue(
        status,
      );

      await controller.getSellerPaymentAccountStatus(req, res);

      expect(
        mockPaymentsService.getSellerPaymentAccountStatus,
      ).toHaveBeenCalledWith('seller-1');
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith(status);
    });
  });

  describe('POST /payments/account/disconnect', () => {
    it('should disconnect the seller Mercado Pago account', async () => {
      const req = mockRequest('seller-1');
      const res = mockResponse();
      mockPaymentsService.disconnectSellerPaymentAccount.mockResolvedValue({
        id: 'seller-1',
      });

      await controller.disconnectSellerPaymentAccount(req, res);

      expect(
        mockPaymentsService.disconnectSellerPaymentAccount,
      ).toHaveBeenCalledWith('seller-1');
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({ disconnected: true });
    });
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

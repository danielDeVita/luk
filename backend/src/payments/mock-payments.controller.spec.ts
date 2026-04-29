import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { MockPaymentsController } from './mock-payments.controller';
import { PaymentsService } from './payments.service';

describe('MockPaymentsController', () => {
  let controller: MockPaymentsController;

  const mockPaymentsService = {
    getMockPaymentForCheckout: jest.fn(),
    processMockPaymentAction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 100 }] }),
      ],
      controllers: [MockPaymentsController],
      providers: [{ provide: PaymentsService, useValue: mockPaymentsService }],
    }).compile();

    controller = module.get(MockPaymentsController);
  });

  it('returns mock payment summary for valid token', async () => {
    mockPaymentsService.getMockPaymentForCheckout.mockResolvedValue({
      id: 'mock_pay_1',
      publicToken: 'token-1',
      raffleId: 'raffle-1',
      raffleTitle: 'QA Raffle',
      buyerId: 'buyer-1',
      buyerEmail: 'buyer@test.com',
      quantity: 2,
      grossSubtotal: 1000,
      discountApplied: 100,
      cashChargedAmount: 900,
      status: 'initiated',
      statusDetail: 'Checkout mock iniciado',
      providerOrderId: 'mock_order_1',
      createdAt: new Date().toISOString(),
    });

    const result = await controller.getMockPayment('mock_pay_1', 'token-1');

    expect(mockPaymentsService.getMockPaymentForCheckout).toHaveBeenCalledWith(
      'mock_pay_1',
      'token-1',
    );
    expect(result.id).toBe('mock_pay_1');
  });

  it('delegates mock action processing', async () => {
    mockPaymentsService.processMockPaymentAction.mockResolvedValue({
      paymentId: 'mock_pay_1',
      status: 'approved',
      providerOrderId: 'mock_order_1',
      redirectUrl:
        'http://localhost:3000/checkout/status?payment_id=mock_pay_1',
      mockToken: 'token-1',
    });

    const result = await controller.applyMockAction('mock_pay_1', {
      publicToken: 'token-1',
      action: 'APPROVE',
    });

    expect(mockPaymentsService.processMockPaymentAction).toHaveBeenCalledWith(
      'mock_pay_1',
      'token-1',
      'APPROVE',
      undefined,
    );
    expect(result.status).toBe('approved');
  });
});

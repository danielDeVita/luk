import { Test, TestingModule } from '@nestjs/testing';
import { PayoutsResolver } from './payouts.resolver';
import { PayoutsService } from './payouts.service';

type MockPayoutsService = {
  getSellerPayouts: jest.Mock;
  getPayoutByRaffleForUser: jest.Mock;
  getPendingPayouts: jest.Mock;
  releasePayoutManually: jest.Mock;
  processDuePayouts: jest.Mock;
};

describe('PayoutsResolver', () => {
  let resolver: PayoutsResolver;
  let service: MockPayoutsService;

  const mockPayoutsService = (): MockPayoutsService => ({
    getSellerPayouts: jest.fn(),
    getPayoutByRaffleForUser: jest.fn(),
    getPendingPayouts: jest.fn(),
    releasePayoutManually: jest.fn(),
    processDuePayouts: jest.fn(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutsResolver,
        { provide: PayoutsService, useValue: mockPayoutsService() },
      ],
    }).compile();

    resolver = module.get<PayoutsResolver>(PayoutsResolver);
    service = module.get(PayoutsService) as unknown as MockPayoutsService;
  });

  describe('myPayouts', () => {
    it('should return seller payouts', async () => {
      const mockPayouts = [
        {
          id: 'payout-1',
          raffleId: 'raffle-1',
          sellerId: 'seller-1',
          totalAmount: 5000,
          platformFee: 200,
          processingFee: 250,
          netAmount: 4550,
          status: 'PENDING',
        },
        {
          id: 'payout-2',
          raffleId: 'raffle-2',
          sellerId: 'seller-1',
          totalAmount: 3000,
          platformFee: 120,
          processingFee: 150,
          netAmount: 2730,
          status: 'RELEASED',
        },
      ];

      service.getSellerPayouts.mockResolvedValue(mockPayouts);

      const result = await resolver.myPayouts({ id: 'seller-1' });

      expect(service.getSellerPayouts).toHaveBeenCalledWith('seller-1');
      expect(result).toEqual(mockPayouts);
    });
  });

  describe('rafflePayout', () => {
    it('should return payout for specific raffle', async () => {
      const mockPayout = {
        id: 'payout-1',
        raffleId: 'raffle-1',
        sellerId: 'seller-1',
        totalAmount: 5000,
        platformFee: 200,
        processingFee: 250,
        netAmount: 4550,
        status: 'PENDING',
      };

      service.getPayoutByRaffleForUser.mockResolvedValue(mockPayout);

      const result = await resolver.rafflePayout(
        { id: 'seller-1', role: 'SELLER' as any },
        'raffle-1',
      );

      expect(service.getPayoutByRaffleForUser).toHaveBeenCalledWith(
        'raffle-1',
        'seller-1',
        'SELLER',
      );
      expect(result).toEqual(mockPayout);
    });

    it('should return null if no payout exists for raffle', async () => {
      service.getPayoutByRaffleForUser.mockResolvedValue(null);

      const result = await resolver.rafflePayout(
        { id: 'seller-1', role: 'SELLER' as any },
        'raffle-unknown',
      );

      expect(service.getPayoutByRaffleForUser).toHaveBeenCalledWith(
        'raffle-unknown',
        'seller-1',
        'SELLER',
      );
      expect(result).toBeNull();
    });
  });

  describe('pendingPayouts', () => {
    it('should return all pending payouts (admin only)', async () => {
      const mockPayouts = [
        {
          id: 'payout-1',
          raffleId: 'raffle-1',
          sellerId: 'seller-1',
          status: 'PENDING',
          netAmount: 4550,
        },
        {
          id: 'payout-2',
          raffleId: 'raffle-2',
          sellerId: 'seller-2',
          status: 'PENDING',
          netAmount: 2730,
        },
      ];

      service.getPendingPayouts.mockResolvedValue(mockPayouts);

      const result = await resolver.pendingPayouts();

      expect(service.getPendingPayouts).toHaveBeenCalled();
      expect(result).toEqual(mockPayouts);
      expect(result).toHaveLength(2);
    });
  });

  describe('releasePayoutManually', () => {
    it('should release payout manually (admin only)', async () => {
      service.releasePayoutManually.mockResolvedValue(true);

      const result = await resolver.releasePayoutManually(
        { id: 'admin-1' },
        'payout-1',
        'Winner confirmed delivery',
      );

      expect(service.releasePayoutManually).toHaveBeenCalledWith(
        'admin-1',
        'payout-1',
        'Winner confirmed delivery',
      );
      expect(result).toBe(true);
    });

    it('should pass admin user ID and reason to service', async () => {
      service.releasePayoutManually.mockResolvedValue(true);

      await resolver.releasePayoutManually(
        { id: 'admin-2' },
        'payout-2',
        'Manual override - support ticket #123',
      );

      expect(service.releasePayoutManually).toHaveBeenCalledWith(
        'admin-2',
        'payout-2',
        'Manual override - support ticket #123',
      );
    });
  });

  describe('processDuePayouts', () => {
    it('should process all due payouts (admin only)', async () => {
      service.processDuePayouts.mockResolvedValue(undefined);

      const result = await resolver.processDuePayouts();

      expect(service.processDuePayouts).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});

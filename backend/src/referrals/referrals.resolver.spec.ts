import { Test, TestingModule } from '@nestjs/testing';
import { ReferralsResolver } from './referrals.resolver';
import { ReferralsService } from './referrals.service';
import { UserRole, MpConnectStatus, KycStatus } from '@prisma/client';

describe('ReferralsResolver', () => {
  let resolver: ReferralsResolver;
  let referralsService: any;

  const mockReferralsService = {
    getReferralStats: jest.fn(),
    getReferralCode: jest.fn(),
    generateReferralCode: jest.fn(),
    applyReferralCode: jest.fn(),
    getReferralCredits: jest.fn(),
    getReferredUsers: jest.fn(),
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

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralsResolver,
        { provide: ReferralsService, useValue: mockReferralsService },
      ],
    }).compile();

    resolver = module.get<ReferralsResolver>(ReferralsResolver);
    referralsService = module.get(ReferralsService);
  });

  describe('myReferralStats', () => {
    it('should return referral statistics for user', async () => {
      const user = createTestUser();
      const stats = {
        referralCode: 'TESTCODE',
        totalReferred: 5,
        totalEarned: 250.5,
        availableBalance: 100.25,
      };

      referralsService.getReferralStats.mockResolvedValue(stats);

      const result = await resolver.myReferralStats(user);

      expect(result).toEqual(stats);
      expect(referralsService.getReferralStats).toHaveBeenCalledWith(user.id);
    });

    it('should handle null referral code', async () => {
      const user = createTestUser();
      const stats = {
        referralCode: null,
        totalReferred: 0,
        totalEarned: 0,
        availableBalance: 0,
      };

      referralsService.getReferralStats.mockResolvedValue(stats);

      const result = await resolver.myReferralStats(user);

      expect(result.referralCode).toBeUndefined();
      expect(result.totalReferred).toBe(0);
    });
  });

  describe('myReferralCode', () => {
    it('should return user referral code', async () => {
      const user = createTestUser();
      const code = 'MYCODE123';

      referralsService.getReferralCode.mockResolvedValue(code);

      const result = await resolver.myReferralCode(user);

      expect(result).toBe(code);
      expect(referralsService.getReferralCode).toHaveBeenCalledWith(user.id);
    });

    it('should return null when user has no code', async () => {
      const user = createTestUser();

      referralsService.getReferralCode.mockResolvedValue(null);

      const result = await resolver.myReferralCode(user);

      expect(result).toBeNull();
    });
  });

  describe('generateReferralCode', () => {
    it('should generate new referral code', async () => {
      const user = createTestUser();
      const newCode = 'NEWCODE456';

      referralsService.generateReferralCode.mockResolvedValue(newCode);

      const result = await resolver.generateReferralCode(user);

      expect(result).toBe(newCode);
      expect(referralsService.generateReferralCode).toHaveBeenCalledWith(
        user.id,
      );
    });

    it('should generate unique code for user', async () => {
      const user = createTestUser({ id: 'specific-user-id' });

      referralsService.generateReferralCode.mockResolvedValue('UNIQUE123');

      await resolver.generateReferralCode(user);

      expect(referralsService.generateReferralCode).toHaveBeenCalledWith(
        'specific-user-id',
      );
    });
  });

  describe('applyReferralCode', () => {
    it('should apply referral code successfully', async () => {
      const user = createTestUser();
      const code = 'FRIENDCODE';

      referralsService.applyReferralCode.mockResolvedValue(true);

      const result = await resolver.applyReferralCode(user, code);

      expect(result).toBe(true);
      expect(referralsService.applyReferralCode).toHaveBeenCalledWith(
        user.id,
        code,
      );
    });

    it('should return false for invalid code', async () => {
      const user = createTestUser();
      const code = 'INVALIDCODE';

      referralsService.applyReferralCode.mockResolvedValue(false);

      const result = await resolver.applyReferralCode(user, code);

      expect(result).toBe(false);
    });

    it('should pass code exactly as provided', async () => {
      const user = createTestUser();
      const code = 'EXACT123';

      referralsService.applyReferralCode.mockResolvedValue(true);

      await resolver.applyReferralCode(user, code);

      expect(referralsService.applyReferralCode).toHaveBeenCalledWith(
        user.id,
        'EXACT123',
      );
    });
  });

  describe('myReferralCredits', () => {
    it('should return referral credits for user', async () => {
      const user = createTestUser();
      const credits = [
        {
          id: 'credit-1',
          userId: 'user-1',
          amount: 50,
          type: 'PURCHASE_REWARD',
          status: 'AVAILABLE',
          description: 'Reward from purchase',
          ticketId: 'ticket-1',
          createdAt: new Date(),
          processedAt: new Date(),
        },
        {
          id: 'credit-2',
          userId: 'user-1',
          amount: 25,
          type: 'PURCHASE_REWARD',
          status: 'USED',
          description: null,
          ticketId: null,
          createdAt: new Date(),
          processedAt: null,
        },
      ];

      referralsService.getReferralCredits.mockResolvedValue(credits);

      const result = await resolver.myReferralCredits(user);

      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe(50);
      expect(result[1].description).toBeUndefined();
      expect(referralsService.getReferralCredits).toHaveBeenCalledWith(user.id);
    });

    it('should convert Decimal amounts to numbers', async () => {
      const user = createTestUser();
      const credits = [
        {
          id: 'credit-1',
          userId: 'user-1',
          amount: 100.5,
          type: 'PURCHASE_REWARD',
          status: 'AVAILABLE',
          description: null,
          ticketId: null,
          createdAt: new Date(),
          processedAt: null,
        },
      ];

      referralsService.getReferralCredits.mockResolvedValue(credits);

      const result = await resolver.myReferralCredits(user);

      expect(typeof result[0].amount).toBe('number');
      expect(result[0].amount).toBe(100.5);
    });

    it('should handle empty credits list', async () => {
      const user = createTestUser();

      referralsService.getReferralCredits.mockResolvedValue([]);

      const result = await resolver.myReferralCredits(user);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('myReferredUsers', () => {
    it('should return referred users', async () => {
      const user = createTestUser();
      const referredUsers = [
        {
          id: 'user-2',
          nombre: 'John',
          apellido: 'Doe',
          createdAt: new Date(),
          hasPurchased: true,
          earnedFromUser: 50,
        },
        {
          id: 'user-3',
          nombre: 'Jane',
          apellido: 'Smith',
          createdAt: new Date(),
          hasPurchased: false,
          earnedFromUser: 0,
        },
      ];

      referralsService.getReferredUsers.mockResolvedValue(referredUsers);

      const result = await resolver.myReferredUsers(user);

      expect(result).toEqual(referredUsers);
      expect(result).toHaveLength(2);
      expect(referralsService.getReferredUsers).toHaveBeenCalledWith(user.id);
    });

    it('should handle empty referred users list', async () => {
      const user = createTestUser();

      referralsService.getReferredUsers.mockResolvedValue([]);

      const result = await resolver.myReferredUsers(user);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should call service with correct user ID', async () => {
      const user = createTestUser({ id: 'custom-user' });

      referralsService.getReferredUsers.mockResolvedValue([]);

      await resolver.myReferredUsers(user);

      expect(referralsService.getReferredUsers).toHaveBeenCalledWith(
        'custom-user',
      );
    });
  });
});

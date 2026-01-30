import { Test, TestingModule } from '@nestjs/testing';
import { ReferralsService } from './referrals.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ReferralCreditStatus, ReferralCreditType } from '@prisma/client';

describe('ReferralsService', () => {
  let service: ReferralsService;
  let prisma: any;
  let notifications: any;

  const mockPrismaService = () => ({
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    referralCredit: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  });

  const mockNotificationsService = {
    sendReferralRewardNotification: jest.fn().mockResolvedValue(true),
    create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
  };

  // Test data factories
  const createTestUser = (overrides = {}) => ({
    id: 'user-1',
    email: 'user@test.com',
    nombre: 'Test',
    apellido: 'User',
    referralCode: null,
    referredById: null,
    referralBalance: 0,
    ...overrides,
  });

  const createTestReferralCredit = (overrides = {}) => ({
    id: 'credit-1',
    userId: 'referrer-1',
    refereeId: 'referee-1',
    amount: 50,
    type: ReferralCreditType.FIRST_PURCHASE_BONUS,
    status: ReferralCreditStatus.CREDITED,
    description: 'Bonificación por primera compra de Juan',
    ticketId: 'ticket-1',
    processedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralsService,
        { provide: PrismaService, useValue: mockPrismaService() },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<ReferralsService>(ReferralsService);
    prisma = module.get(PrismaService);
    notifications = module.get(NotificationsService);
  });

  describe('generateReferralCode', () => {
    it('should return existing referral code if user already has one', async () => {
      const user = createTestUser({ referralCode: 'TEUS1234' });
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.generateReferralCode('user-1');

      expect(result).toBe('TEUS1234');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should generate new referral code for user without one', async () => {
      const user = createTestUser({ referralCode: null });
      prisma.user.findUnique
        .mockResolvedValueOnce(user) // First call in service
        .mockResolvedValueOnce(null); // Check for uniqueness

      prisma.user.update.mockResolvedValue({
        ...user,
        referralCode: 'TEUS5678',
      });

      const result = await service.generateReferralCode('user-1');

      expect(result).toMatch(/^TEUS[A-Z0-9]{4}$/); // Format: TEUS + 4 random chars
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { referralCode: expect.any(String) },
      });
    });

    it('should generate code with correct prefix from user name', async () => {
      const user = createTestUser({
        nombre: 'Juan',
        apellido: 'Perez', // No accent, so should be JUPE
        referralCode: null,
      });
      prisma.user.findUnique
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(null);

      prisma.user.update.mockResolvedValue({
        ...user,
        referralCode: 'JUPE1234',
      });

      const result = await service.generateReferralCode('user-1');

      expect(result).toMatch(/^JUPE[A-Z0-9]{4}$/);
    });

    it('should retry if generated code already exists', async () => {
      const user = createTestUser({ referralCode: null });
      prisma.user.findUnique
        .mockResolvedValueOnce(user) // First call in service
        .mockResolvedValueOnce({ id: 'other-user' }) // First code exists
        .mockResolvedValueOnce(null); // Second code is unique

      prisma.user.update.mockResolvedValue({
        ...user,
        referralCode: 'TEUS5678',
      });

      const result = await service.generateReferralCode('user-1');

      expect(result).toBeDefined();
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(3);
    });

    it('should fallback to fully random code after 10 attempts', async () => {
      const user = createTestUser({ referralCode: null });
      prisma.user.findUnique.mockResolvedValue({ id: 'other-user' }); // All codes exist
      prisma.user.findUnique.mockResolvedValueOnce(user); // First call

      prisma.user.update.mockResolvedValue({
        ...user,
        referralCode: 'ABC12345',
      });

      const result = await service.generateReferralCode('user-1');

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThanOrEqual(8);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.generateReferralCode('user-1')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.generateReferralCode('user-1')).rejects.toThrow(
        'Usuario no encontrado',
      );
    });

    it('should replace non-alphabetic characters in prefix with X', async () => {
      const user = createTestUser({
        nombre: '123',
        apellido: '456',
        referralCode: null,
      });
      prisma.user.findUnique
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(null);

      prisma.user.update.mockResolvedValue({
        ...user,
        referralCode: 'XXXX1234',
      });

      const result = await service.generateReferralCode('user-1');

      expect(result).toMatch(/^XXXX[A-Z0-9]{4}$/);
    });
  });

  describe('applyReferralCode', () => {
    it('should successfully apply a valid referral code', async () => {
      const referee = createTestUser({ id: 'referee-1', referredById: null });
      const referrer = createTestUser({
        id: 'referrer-1',
        referralCode: 'TEUS1234',
      });

      prisma.user.findUnique
        .mockResolvedValueOnce(referee) // Find referee
        .mockResolvedValueOnce(referrer); // Find referrer by code

      prisma.user.update.mockResolvedValue({
        ...referee,
        referredById: 'referrer-1',
      });

      const result = await service.applyReferralCode('referee-1', 'TEUS1234');

      expect(result).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'referee-1' },
        data: { referredById: 'referrer-1' },
      });
    });

    it('should throw NotFoundException if referee user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.applyReferralCode('referee-1', 'TEUS1234'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.applyReferralCode('referee-1', 'TEUS1234'),
      ).rejects.toThrow('Usuario no encontrado');
    });

    it('should throw BadRequestException if user already has referral code applied', async () => {
      const referee = createTestUser({
        id: 'referee-1',
        referredById: 'other-referrer',
      });
      prisma.user.findUnique.mockResolvedValue(referee);

      await expect(
        service.applyReferralCode('referee-1', 'TEUS1234'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.applyReferralCode('referee-1', 'TEUS1234'),
      ).rejects.toThrow('Ya tenés un código de referido aplicado');
    });

    it('should throw BadRequestException if referral code is invalid', async () => {
      const referee = createTestUser({ id: 'referee-1', referredById: null });
      prisma.user.findUnique
        .mockResolvedValueOnce(referee) // First call: find referee
        .mockResolvedValueOnce(null) // Second call: referrer not found
        .mockResolvedValueOnce(referee) // Third call: find referee again (second test)
        .mockResolvedValueOnce(null); // Fourth call: referrer not found again

      await expect(
        service.applyReferralCode('referee-1', 'INVALID'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.applyReferralCode('referee-1', 'INVALID'),
      ).rejects.toThrow('Código de referido inválido');
    });

    it('should throw BadRequestException if user tries to use their own code', async () => {
      const user = createTestUser({
        id: 'user-1',
        referralCode: 'TEUS1234',
        referredById: null,
      });
      prisma.user.findUnique.mockResolvedValue(user); // Both calls return same user

      await expect(
        service.applyReferralCode('user-1', 'TEUS1234'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.applyReferralCode('user-1', 'TEUS1234'),
      ).rejects.toThrow('No podés usar tu propio código de referido');
    });

    it('should convert referral code to uppercase', async () => {
      const referee = createTestUser({ referredById: null });
      const referrer = createTestUser({
        id: 'referrer-1',
        referralCode: 'TEUS1234',
      });

      prisma.user.findUnique
        .mockResolvedValueOnce(referee)
        .mockResolvedValueOnce(referrer);

      prisma.user.update.mockResolvedValue({
        ...referee,
        referredById: 'referrer-1',
      });

      await service.applyReferralCode('referee-1', 'teus1234'); // lowercase

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { referralCode: 'TEUS1234' }, // Should be uppercase
        select: { id: true, nombre: true, email: true },
      });
    });
  });

  describe('processFirstPurchaseReward', () => {
    it('should process referral reward for first purchase', async () => {
      const referee = createTestUser({
        id: 'referee-1',
        nombre: 'Juan',
        referredById: 'referrer-1',
      });
      const referrer = createTestUser({
        id: 'referrer-1',
        nombre: 'María',
        email: 'referrer@test.com',
        referralBalance: 100,
      });

      prisma.user.findUnique
        .mockResolvedValueOnce(referee) // Find referee
        .mockResolvedValueOnce(referrer); // Find referrer

      prisma.referralCredit.findFirst.mockResolvedValue(null); // No existing reward

      const mockCredit = createTestReferralCredit({
        amount: 50,
        refereeId: 'referee-1',
      });

      // Mock transaction to execute the operations
      prisma.$transaction.mockImplementation(async (_operations: any) => {
        // Execute the operations and return results
        return [mockCredit, { ...referrer, referralBalance: 150 }];
      });

      await service.processFirstPurchaseReward('referee-1', 1000, 'ticket-1');

      // Verify transaction was called
      expect(prisma.$transaction).toHaveBeenCalled();
      const transactionCall = prisma.$transaction.mock.calls[0][0];
      expect(transactionCall).toHaveLength(2);

      expect(notifications.sendReferralRewardNotification).toHaveBeenCalledWith(
        'referrer@test.com',
        {
          refereeName: 'Juan',
          amount: 50,
          totalBalance: 150, // 100 + 50
        },
      );

      expect(notifications.create).toHaveBeenCalledWith(
        'referrer-1',
        'INFO',
        '💰 ¡Ganaste crédito de referido!',
        expect.stringContaining('Juan'),
      );
    });

    it('should calculate 5% reward correctly', async () => {
      const referee = createTestUser({
        id: 'referee-1',
        nombre: 'Juan',
        referredById: 'referrer-1',
      });
      const referrer = createTestUser({
        id: 'referrer-1',
        email: 'referrer@test.com',
        referralBalance: 0,
      });

      prisma.user.findUnique
        .mockResolvedValueOnce(referee)
        .mockResolvedValueOnce(referrer);

      prisma.referralCredit.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockResolvedValue([{}, {}]);

      await service.processFirstPurchaseReward('referee-1', 2345.67);

      expect(prisma.$transaction).toHaveBeenCalled();

      // Verify the notification was sent with the correct 5% amount
      expect(notifications.sendReferralRewardNotification).toHaveBeenCalledWith(
        'referrer@test.com',
        expect.objectContaining({
          refereeName: 'Juan',
          amount: 117.28, // 5% of 2345.67, rounded to 2 decimals
          totalBalance: 117.28, // 0 + 117.28
        }),
      );
    });

    it('should skip if user has no referrer', async () => {
      const referee = createTestUser({ referredById: null });
      prisma.user.findUnique.mockResolvedValue(referee);

      await service.processFirstPurchaseReward('referee-1', 1000);

      expect(prisma.referralCredit.findFirst).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should skip if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service.processFirstPurchaseReward('referee-1', 1000);

      expect(prisma.referralCredit.findFirst).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should skip if reward was already processed', async () => {
      const referee = createTestUser({
        id: 'referee-1',
        referredById: 'referrer-1',
      });
      const existingReward = createTestReferralCredit({
        refereeId: 'referee-1',
        type: ReferralCreditType.FIRST_PURCHASE_BONUS,
      });

      prisma.user.findUnique.mockResolvedValue(referee);
      prisma.referralCredit.findFirst.mockResolvedValue(existingReward);

      await service.processFirstPurchaseReward('referee-1', 1000);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should skip if referrer does not exist', async () => {
      const referee = createTestUser({
        id: 'referee-1',
        referredById: 'referrer-1',
      });

      prisma.user.findUnique
        .mockResolvedValueOnce(referee)
        .mockResolvedValueOnce(null); // Referrer not found

      prisma.referralCredit.findFirst.mockResolvedValue(null);

      await service.processFirstPurchaseReward('referee-1', 1000);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should handle notification errors gracefully', async () => {
      const referee = createTestUser({
        id: 'referee-1',
        nombre: 'Juan',
        referredById: 'referrer-1',
      });
      const referrer = createTestUser({
        id: 'referrer-1',
        referralBalance: 0,
      });

      prisma.user.findUnique
        .mockResolvedValueOnce(referee)
        .mockResolvedValueOnce(referrer);

      prisma.referralCredit.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockResolvedValue([{}, {}]);

      // Make notifications fail
      notifications.sendReferralRewardNotification.mockRejectedValue(
        new Error('Email service down'),
      );
      notifications.create.mockRejectedValue(new Error('Database error'));

      // Should not throw error
      await expect(
        service.processFirstPurchaseReward('referee-1', 1000),
      ).resolves.not.toThrow();
    });
  });

  describe('getReferralStats', () => {
    it('should return referral statistics', async () => {
      const user = createTestUser({
        referralCode: 'TEUS1234',
        referralBalance: 250.5,
      });

      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.count.mockResolvedValue(5); // 5 referred users

      prisma.referralCredit.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 300 } }) // Credited
        .mockResolvedValueOnce({ _sum: { amount: 50 } }); // Pending

      const result = await service.getReferralStats('user-1');

      expect(result).toEqual({
        referralCode: 'TEUS1234',
        totalReferred: 5,
        totalEarned: 300,
        pendingCredits: 50,
        availableBalance: 250.5,
      });
    });

    it('should handle null aggregates gracefully', async () => {
      const user = createTestUser({
        referralCode: 'TEUS1234',
        referralBalance: 0,
      });

      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.count.mockResolvedValue(0);

      prisma.referralCredit.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } });

      const result = await service.getReferralStats('user-1');

      expect(result).toEqual({
        referralCode: 'TEUS1234',
        totalReferred: 0,
        totalEarned: 0,
        pendingCredits: 0,
        availableBalance: 0,
      });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getReferralStats('user-1')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getReferralStats('user-1')).rejects.toThrow(
        'Usuario no encontrado',
      );
    });
  });

  describe('getReferredUsers', () => {
    it('should return referred users with earnings', async () => {
      const referredUsers = [
        {
          id: 'ref-1',
          nombre: 'Juan',
          apellido: 'Pérez',
          createdAt: new Date('2025-01-01'),
        },
        {
          id: 'ref-2',
          nombre: 'María',
          apellido: 'González',
          createdAt: new Date('2025-01-02'),
        },
      ];

      const credits = [
        createTestReferralCredit({
          refereeId: 'ref-1',
          amount: 50,
          status: ReferralCreditStatus.CREDITED,
        }),
        createTestReferralCredit({
          refereeId: 'ref-2',
          amount: 75,
          status: ReferralCreditStatus.CREDITED,
        }),
      ];

      prisma.user.findMany.mockResolvedValue(referredUsers);
      prisma.referralCredit.findMany.mockResolvedValue(credits);

      const result = await service.getReferredUsers('user-1');

      expect(result).toEqual([
        {
          id: 'ref-1',
          nombre: 'Juan',
          apellido: 'Pérez',
          createdAt: new Date('2025-01-01'),
          hasPurchased: true,
          earnedFromUser: 50,
        },
        {
          id: 'ref-2',
          nombre: 'María',
          apellido: 'González',
          createdAt: new Date('2025-01-02'),
          hasPurchased: true,
          earnedFromUser: 75,
        },
      ]);
    });

    it('should mark users without purchases correctly', async () => {
      const referredUsers = [
        {
          id: 'ref-1',
          nombre: 'Juan',
          apellido: 'Pérez',
          createdAt: new Date('2025-01-01'),
        },
      ];

      prisma.user.findMany.mockResolvedValue(referredUsers);
      prisma.referralCredit.findMany.mockResolvedValue([]); // No credits

      const result = await service.getReferredUsers('user-1');

      expect(result[0]).toEqual({
        id: 'ref-1',
        nombre: 'Juan',
        apellido: 'Pérez',
        createdAt: new Date('2025-01-01'),
        hasPurchased: false,
        earnedFromUser: 0,
      });
    });

    it('should exclude pending credits from earned amount', async () => {
      const referredUsers = [
        {
          id: 'ref-1',
          nombre: 'Juan',
          apellido: 'Pérez',
          createdAt: new Date('2025-01-01'),
        },
      ];

      const credits = [
        createTestReferralCredit({
          refereeId: 'ref-1',
          amount: 50,
          status: ReferralCreditStatus.CREDITED,
        }),
        createTestReferralCredit({
          refereeId: 'ref-1',
          amount: 25,
          status: ReferralCreditStatus.PENDING,
        }),
      ];

      prisma.user.findMany.mockResolvedValue(referredUsers);
      prisma.referralCredit.findMany.mockResolvedValue(credits);

      const result = await service.getReferredUsers('user-1');

      expect(result[0].earnedFromUser).toBe(50); // Only credited
    });
  });

  describe('getReferralCredits', () => {
    it('should return referral credits history', async () => {
      const credits = [
        createTestReferralCredit({ createdAt: new Date('2025-01-02') }),
        createTestReferralCredit({ createdAt: new Date('2025-01-01') }),
      ];

      prisma.referralCredit.findMany.mockResolvedValue(credits);

      const result = await service.getReferralCredits('user-1');

      expect(result).toEqual(credits);
      expect(prisma.referralCredit.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getReferralCode', () => {
    it('should return user referral code if exists', async () => {
      const user = createTestUser({ referralCode: 'TEUS1234' });
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getReferralCode('user-1');

      expect(result).toBe('TEUS1234');
    });

    it('should return null if user has no referral code', async () => {
      const user = createTestUser({ referralCode: null });
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getReferralCode('user-1');

      expect(result).toBeNull();
    });

    it('should return null if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getReferralCode('user-1');

      expect(result).toBeNull();
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';
import { AuditService } from '../audit/audit.service';
import { DisputesService } from '../disputes/disputes.service';
import { User, UserRole } from '@prisma/client';

type MockAdminService = {
  getMpEvents: jest.Mock;
  getMpEventById: jest.Mock;
  getPaymentDebugInfo: jest.Mock;
  getTransactions: jest.Mock;
  getAdminStats: jest.Mock;
  getUsers: jest.Mock;
  getUserActivity: jest.Mock;
  banUser: jest.Mock;
  unbanUser: jest.Mock;
  getPendingKycSubmissions: jest.Mock;
  approveKyc: jest.Mock;
  rejectKyc: jest.Mock;
};

type MockAuditService = {
  logUserBan: jest.Mock;
  logUserUnban: jest.Mock;
  log: jest.Mock;
};

type MockDisputesService = {
  resolveDispute: jest.Mock;
};

describe('AdminResolver', () => {
  let resolver: AdminResolver;
  let adminService: MockAdminService;
  let auditService: MockAuditService;
  let disputesService: MockDisputesService;

  const mockAdminService = (): MockAdminService => ({
    getMpEvents: jest.fn(),
    getMpEventById: jest.fn(),
    getPaymentDebugInfo: jest.fn(),
    getTransactions: jest.fn(),
    getAdminStats: jest.fn(),
    getUsers: jest.fn(),
    getUserActivity: jest.fn(),
    banUser: jest.fn(),
    unbanUser: jest.fn(),
    getPendingKycSubmissions: jest.fn(),
    approveKyc: jest.fn(),
    rejectKyc: jest.fn(),
  });

  const mockAuditService = (): MockAuditService => ({
    logUserBan: jest.fn(),
    logUserUnban: jest.fn(),
    log: jest.fn(),
  });

  const mockDisputesService = (): MockDisputesService => ({
    resolveDispute: jest.fn(),
  });

  const mockAdmin = (): User =>
    ({
      id: 'admin-1',
      email: 'admin@test.com',
      nombre: 'Admin',
      apellido: 'User',
      role: UserRole.ADMIN,
    }) as any;

  const mockUser = (): User =>
    ({
      id: 'user-1',
      email: 'user@test.com',
      nombre: 'Test',
      apellido: 'User',
      role: UserRole.USER,
    }) as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminResolver,
        { provide: AdminService, useValue: mockAdminService() },
        { provide: AuditService, useValue: mockAuditService() },
        { provide: DisputesService, useValue: mockDisputesService() },
      ],
    }).compile();

    resolver = module.get<AdminResolver>(AdminResolver);
    adminService = module.get(AdminService) as unknown as MockAdminService;
    auditService = module.get(AuditService) as unknown as MockAuditService;
    disputesService = module.get(
      DisputesService,
    ) as unknown as MockDisputesService;
  });

  describe('mpEvents', () => {
    it('should return MP webhook events with pagination', async () => {
      const mockEvents = {
        events: [
          {
            id: 'event-1',
            eventType: 'payment',
            metadata: { paymentId: '123' },
          },
        ],
        total: 1,
      };
      adminService.getMpEvents.mockResolvedValue(mockEvents);

      const result = await resolver.mpEvents('payment', 10, 0);

      expect(adminService.getMpEvents).toHaveBeenCalledWith({
        eventType: 'payment',
        limit: 10,
        offset: 0,
      });
      expect(result.events).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('mpEvent', () => {
    it('should return single MP event by ID', async () => {
      const mockEvent = {
        id: 'event-1',
        eventType: 'payment',
        metadata: { paymentId: '123' },
      };
      adminService.getMpEventById.mockResolvedValue(mockEvent);

      const result = await resolver.mpEvent('event-1');

      expect(adminService.getMpEventById).toHaveBeenCalledWith('event-1');
      expect(result).toEqual(mockEvent);
    });

    it('should return null for non-existent event', async () => {
      adminService.getMpEventById.mockResolvedValue(null);

      const result = await resolver.mpEvent('invalid-id');

      expect(result).toBeNull();
    });
  });

  describe('paymentDebug', () => {
    it('should return payment debug info', async () => {
      const mockDebugInfo = {
        mpPaymentId: '123',
        status: 'approved',
        transactionAmount: 1000,
        tickets: [{ id: 'ticket-1', precioPagado: 1000 }],
      };
      adminService.getPaymentDebugInfo.mockResolvedValue(mockDebugInfo);

      const result = await resolver.paymentDebug('123');

      expect(adminService.getPaymentDebugInfo).toHaveBeenCalledWith('123');
      expect(result.mpPaymentId).toBe('123');
      expect(result.tickets).toHaveLength(1);
    });
  });

  describe('promotionGrantReversalLogs', () => {
    it('should return mapped reversal transactions', async () => {
      adminService.getTransactions.mockResolvedValue({
        transactions: [
          {
            id: 'tx-1',
            tipo: 'REVERSION_BONIFICACION_PROMOCIONAL',
            monto: '1000.50',
            grossAmount: '12000',
            promotionDiscountAmount: '1000.50',
            cashChargedAmount: '11000',
            estado: 'COMPLETADO',
            mpPaymentId: 'mp-123',
            metadata: { refundType: 'full', refundAmount: 11000 },
            createdAt: new Date('2026-03-14T12:00:00.000Z'),
            user: {
              id: 'user-1',
              email: 'buyer@test.com',
              nombre: 'Buyer',
              apellido: 'User',
            },
            raffle: {
              id: 'raffle-1',
              titulo: 'Rifa test',
            },
          },
        ],
        total: 1,
      });

      const result = await resolver.promotionGrantReversalLogs(20, 0);

      expect(adminService.getTransactions).toHaveBeenCalledWith({
        tipo: 'REVERSION_BONIFICACION_PROMOCIONAL',
        limit: 20,
        offset: 0,
      });
      expect(result.total).toBe(1);
      expect(result.transactions[0].monto).toBe(1000.5);
      expect(result.transactions[0].promotionDiscountAmount).toBe(1000.5);
      expect(result.transactions[0].metadata).toEqual({
        refundType: 'full',
        refundAmount: 11000,
      });
    });
  });

  describe('adminStats', () => {
    it('should return admin dashboard statistics', async () => {
      const mockStats = {
        totalUsers: 100,
        totalRaffles: 50,
        totalTicketsSold: 1000,
        totalRevenue: 50000,
        pendingKyc: 5,
        pendingDisputes: 3,
      };
      adminService.getAdminStats.mockResolvedValue(mockStats);

      const result = await resolver.adminStats();

      expect(adminService.getAdminStats).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  describe('adminUsers', () => {
    it('should return users with filters', async () => {
      const mockUserList = {
        users: [mockUser()],
        total: 1,
      };
      adminService.getUsers.mockResolvedValue(mockUserList);

      const result = await resolver.adminUsers(
        UserRole.USER,
        'test@test.com',
        false,
        10,
        0,
      );

      expect(adminService.getUsers).toHaveBeenCalledWith({
        role: UserRole.USER,
        search: 'test@test.com',
        includeDeleted: false,
        limit: 10,
        offset: 0,
      });
      expect(result.users).toHaveLength(1);
    });
  });

  describe('adminUserActivity', () => {
    it('should return user activity log', async () => {
      const mockActivities = [
        {
          id: 'activity-1',
          action: 'LOGIN',
          targetType: null,
          targetId: null,
          metadata: { ip: '127.0.0.1' },
          ipAddress: '127.0.0.1',
          createdAt: new Date(),
        },
      ];
      adminService.getUserActivity.mockResolvedValue(mockActivities);

      const result = await resolver.adminUserActivity('user-1', 10, 0);

      expect(adminService.getUserActivity).toHaveBeenCalledWith(
        'user-1',
        10,
        0,
      );
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('LOGIN');
    });
  });

  describe('banUser', () => {
    it('should ban user and log audit action', async () => {
      const admin = mockAdmin();
      const bannedUser = { ...mockUser(), bannedAt: new Date() };
      adminService.banUser.mockResolvedValue(bannedUser);
      auditService.logUserBan.mockResolvedValue(undefined);

      const result = await resolver.banUser(admin, 'user-1', 'Fraud detected');

      expect(adminService.banUser).toHaveBeenCalledWith('user-1');
      expect(auditService.logUserBan).toHaveBeenCalledWith(
        admin.id,
        'user-1',
        'Fraud detected',
      );
      expect(result).toEqual(bannedUser);
    });
  });

  describe('unbanUser', () => {
    it('should unban user and log audit action', async () => {
      const admin = mockAdmin();
      const unbannedUser = { ...mockUser(), bannedAt: null };
      adminService.unbanUser.mockResolvedValue(unbannedUser);
      auditService.logUserUnban.mockResolvedValue(undefined);

      const result = await resolver.unbanUser(
        admin,
        'user-1',
        'Appealed successfully',
      );

      expect(adminService.unbanUser).toHaveBeenCalledWith('user-1');
      expect(auditService.logUserUnban).toHaveBeenCalledWith(
        admin.id,
        'user-1',
        'Appealed successfully',
      );
      expect(result).toEqual(unbannedUser);
    });
  });

  describe('pendingKycSubmissions', () => {
    it('should return pending KYC submissions', async () => {
      const mockSubmissions = {
        submissions: [
          {
            userId: 'user-1',
            documentType: 'DNI',
            kycStatus: 'PENDING_REVIEW',
          },
        ],
        total: 1,
      };
      adminService.getPendingKycSubmissions.mockResolvedValue(mockSubmissions);

      const result = await resolver.pendingKycSubmissions(10, 0);

      expect(adminService.getPendingKycSubmissions).toHaveBeenCalledWith(10, 0);
      expect(result.submissions).toHaveLength(1);
    });
  });

  describe('approveKyc', () => {
    it('should approve KYC and log audit action', async () => {
      const admin = mockAdmin();
      const approvalResult = {
        success: true,
        userId: 'user-1',
        message: 'KYC approved',
      };
      adminService.approveKyc.mockResolvedValue(approvalResult);
      auditService.log.mockResolvedValue(undefined);

      const result = await resolver.approveKyc(admin, 'user-1');

      expect(adminService.approveKyc).toHaveBeenCalledWith('user-1');
      expect(auditService.log).toHaveBeenCalledWith({
        adminId: admin.id,
        action: 'KYC_APPROVED',
        targetType: 'USER',
        targetId: 'user-1',
        details: { approvedBy: admin.email },
      });
      expect(result).toEqual(approvalResult);
    });
  });

  describe('rejectKyc', () => {
    it('should reject KYC and log audit action', async () => {
      const admin = mockAdmin();
      const rejectionResult = {
        success: true,
        userId: 'user-1',
        message: 'KYC rejected',
      };
      adminService.rejectKyc.mockResolvedValue(rejectionResult);
      auditService.log.mockResolvedValue(undefined);

      const result = await resolver.rejectKyc(
        admin,
        'user-1',
        'Invalid document',
      );

      expect(adminService.rejectKyc).toHaveBeenCalledWith(
        'user-1',
        'Invalid document',
      );
      expect(auditService.log).toHaveBeenCalledWith({
        adminId: admin.id,
        action: 'KYC_REJECTED',
        targetType: 'USER',
        targetId: 'user-1',
        details: { rejectedBy: admin.email, reason: 'Invalid document' },
      });
      expect(result).toEqual(rejectionResult);
    });
  });

  describe('bulkResolveDisputes', () => {
    it('should resolve multiple disputes successfully', async () => {
      const admin = mockAdmin();
      const disputeIds = ['dispute-1', 'dispute-2', 'dispute-3'];
      disputesService.resolveDispute.mockResolvedValue({});

      const result = await resolver.bulkResolveDisputes(
        admin,
        disputeIds,
        'RESUELTA_COMPRADOR',
        'Refund approved',
        'Admin notes',
      );

      expect(disputesService.resolveDispute).toHaveBeenCalledTimes(3);
      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle partial failures when resolving disputes', async () => {
      const admin = mockAdmin();
      const disputeIds = ['dispute-1', 'dispute-2', 'dispute-3'];
      disputesService.resolveDispute
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Dispute not found'))
        .mockResolvedValueOnce({});

      const result = await resolver.bulkResolveDisputes(
        admin,
        disputeIds,
        'RESUELTA_VENDEDOR',
        'No refund',
      );

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.failedIds).toEqual(['dispute-2']);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Dispute not found');
    });
  });
});

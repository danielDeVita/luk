import { Test, TestingModule } from '@nestjs/testing';
import { AuditResolver } from './audit.resolver';
import { AuditService } from './audit.service';
import { AuditAction } from '@prisma/client';

type MockAuditService = {
  getAuditLogs: jest.Mock;
  getAuditLogsForTarget: jest.Mock;
};

describe('AuditResolver', () => {
  let resolver: AuditResolver;
  let service: MockAuditService;

  const mockAuditService = (): MockAuditService => ({
    getAuditLogs: jest.fn(),
    getAuditLogsForTarget: jest.fn(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditResolver,
        { provide: AuditService, useValue: mockAuditService() },
      ],
    }).compile();

    resolver = module.get<AuditResolver>(AuditResolver);
    service = module.get(AuditService) as unknown as MockAuditService;
  });

  describe('auditLogs', () => {
    it('should return all audit logs without filters', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: AuditAction.KYC_APPROVED,
          targetType: 'User',
          targetId: 'user-1',
          adminId: 'admin-1',
          details: { reason: 'Documents verified' },
          admin: { email: 'admin@example.com' },
        },
        {
          id: 'log-2',
          action: AuditAction.RAFFLE_HIDDEN,
          targetType: 'Raffle',
          targetId: 'raffle-1',
          adminId: 'admin-1',
          details: { reason: 'Inappropriate content' },
          admin: { email: 'admin@example.com' },
        },
      ];

      service.getAuditLogs.mockResolvedValue({
        logs: mockLogs,
        total: 2,
      });

      const result = await resolver.auditLogs();

      expect(service.getAuditLogs).toHaveBeenCalledWith({
        adminId: undefined,
        action: undefined,
        targetType: undefined,
        targetId: undefined,
        limit: undefined,
        offset: undefined,
      });
      expect(result).toHaveLength(2);
      expect(result[0].details).toBe('{"reason":"Documents verified"}');
      expect(result[0].adminEmail).toBe('admin@example.com');
    });

    it('should filter audit logs by adminId', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: AuditAction.KYC_APPROVED,
          targetType: 'User',
          targetId: 'user-1',
          adminId: 'admin-1',
          details: null,
          admin: { email: 'admin@example.com' },
        },
      ];

      service.getAuditLogs.mockResolvedValue({
        logs: mockLogs,
        total: 1,
      });

      const result = await resolver.auditLogs('admin-1');

      expect(service.getAuditLogs).toHaveBeenCalledWith({
        adminId: 'admin-1',
        action: undefined,
        targetType: undefined,
        targetId: undefined,
        limit: undefined,
        offset: undefined,
      });
      expect(result).toHaveLength(1);
      expect(result[0].details).toBeNull();
    });

    it('should filter audit logs by action', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: AuditAction.USER_BANNED,
          targetType: 'User',
          targetId: 'user-1',
          adminId: 'admin-1',
          details: { reason: 'Fraud' },
          admin: { email: 'admin@example.com' },
        },
      ];

      service.getAuditLogs.mockResolvedValue({
        logs: mockLogs,
        total: 1,
      });

      const result = await resolver.auditLogs(
        undefined,
        AuditAction.USER_BANNED,
      );

      expect(service.getAuditLogs).toHaveBeenCalledWith({
        adminId: undefined,
        action: AuditAction.USER_BANNED,
        targetType: undefined,
        targetId: undefined,
        limit: undefined,
        offset: undefined,
      });
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe(AuditAction.USER_BANNED);
    });

    it('should filter audit logs by targetType and targetId', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: AuditAction.RAFFLE_HIDDEN,
          targetType: 'Raffle',
          targetId: 'raffle-1',
          adminId: 'admin-1',
          details: { reason: 'Policy violation' },
          admin: { email: 'admin@example.com' },
        },
      ];

      service.getAuditLogs.mockResolvedValue({
        logs: mockLogs,
        total: 1,
      });

      const result = await resolver.auditLogs(
        undefined,
        undefined,
        'Raffle',
        'raffle-1',
      );

      expect(service.getAuditLogs).toHaveBeenCalledWith({
        adminId: undefined,
        action: undefined,
        targetType: 'Raffle',
        targetId: 'raffle-1',
        limit: undefined,
        offset: undefined,
      });
      expect(result).toHaveLength(1);
      expect(result[0].targetType).toBe('Raffle');
      expect(result[0].targetId).toBe('raffle-1');
    });

    it('should support pagination with limit and offset', async () => {
      const mockLogs = [
        {
          id: 'log-11',
          action: AuditAction.KYC_APPROVED,
          targetType: 'User',
          targetId: 'user-11',
          adminId: 'admin-1',
          details: null,
          admin: { email: 'admin@example.com' },
        },
        {
          id: 'log-12',
          action: AuditAction.KYC_REJECTED,
          targetType: 'User',
          targetId: 'user-12',
          adminId: 'admin-1',
          details: null,
          admin: { email: 'admin@example.com' },
        },
      ];

      service.getAuditLogs.mockResolvedValue({
        logs: mockLogs,
        total: 20,
      });

      const result = await resolver.auditLogs(
        undefined,
        undefined,
        undefined,
        undefined,
        10,
        10,
      );

      expect(service.getAuditLogs).toHaveBeenCalledWith({
        adminId: undefined,
        action: undefined,
        targetType: undefined,
        targetId: undefined,
        limit: 10,
        offset: 10,
      });
      expect(result).toHaveLength(2);
    });

    it('should stringify details object correctly', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: AuditAction.PAYOUT_RELEASED,
          targetType: 'Payout',
          targetId: 'payout-1',
          adminId: 'admin-1',
          details: {
            amount: 1500,
            raffleId: 'raffle-1',
            reason: 'Manual approval',
          },
          admin: { email: 'admin@example.com' },
        },
      ];

      service.getAuditLogs.mockResolvedValue({
        logs: mockLogs,
        total: 1,
      });

      const result = await resolver.auditLogs();

      expect(result[0].details).toBe(
        '{"amount":1500,"raffleId":"raffle-1","reason":"Manual approval"}',
      );
    });
  });

  describe('auditLogsForTarget', () => {
    it('should return all audit logs for a specific target', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: AuditAction.KYC_REJECTED,
          targetType: 'User',
          targetId: 'user-1',
          adminId: 'admin-1',
          details: null,
          admin: { email: 'admin@example.com' },
        },
        {
          id: 'log-2',
          action: AuditAction.KYC_APPROVED,
          targetType: 'User',
          targetId: 'user-1',
          adminId: 'admin-2',
          details: { verifiedBy: 'admin-2' },
          admin: { email: 'admin2@example.com' },
        },
      ];

      service.getAuditLogsForTarget.mockResolvedValue(mockLogs);

      const result = await resolver.auditLogsForTarget('User', 'user-1');

      expect(service.getAuditLogsForTarget).toHaveBeenCalledWith(
        'User',
        'user-1',
      );
      expect(result).toHaveLength(2);
      expect(result[0].targetType).toBe('User');
      expect(result[0].targetId).toBe('user-1');
      expect(result[1].details).toBe('{"verifiedBy":"admin-2"}');
      expect(result[1].adminEmail).toBe('admin2@example.com');
    });

    it('should handle empty audit logs for target', async () => {
      service.getAuditLogsForTarget.mockResolvedValue([]);

      const result = await resolver.auditLogsForTarget('Raffle', 'raffle-999');

      expect(service.getAuditLogsForTarget).toHaveBeenCalledWith(
        'Raffle',
        'raffle-999',
      );
      expect(result).toHaveLength(0);
    });

    it('should stringify details for target logs', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: AuditAction.RAFFLE_HIDDEN,
          targetType: 'Raffle',
          targetId: 'raffle-1',
          adminId: 'admin-1',
          details: {
            reason: 'Violates content policy',
            reportCount: 5,
            hiddenAt: '2024-01-31T12:00:00Z',
          },
          admin: { email: 'admin@example.com' },
        },
      ];

      service.getAuditLogsForTarget.mockResolvedValue(mockLogs);

      const result = await resolver.auditLogsForTarget('Raffle', 'raffle-1');

      expect(result[0].details).toBe(
        '{"reason":"Violates content policy","reportCount":5,"hiddenAt":"2024-01-31T12:00:00Z"}',
      );
    });
  });
});

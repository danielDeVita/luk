import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';

type MockPrismaService = {
  auditLog: {
    create: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
};

describe('AuditService', () => {
  let service: AuditService;
  let prisma: MockPrismaService;

  const mockPrismaService = (): MockPrismaService => ({
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrismaService() },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    prisma = module.get(PrismaService) as unknown as MockPrismaService;
  });

  describe('log', () => {
    it('should create audit log entry', async () => {
      const mockAuditLog = {
        id: 'audit-1',
        adminId: 'admin-1',
        action: AuditAction.USER_BANNED,
        targetType: 'User',
        targetId: 'user-1',
        details: { reason: 'Fraud' },
        reason: 'Test reason',
        createdAt: new Date(),
      };

      prisma.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await service.log({
        adminId: 'admin-1',
        action: AuditAction.USER_BANNED,
        targetType: 'User',
        targetId: 'user-1',
        details: { reason: 'Fraud' },
        reason: 'Test reason',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-1',
          action: AuditAction.USER_BANNED,
          targetType: 'User',
          targetId: 'user-1',
          details: { reason: 'Fraud' },
          reason: 'Test reason',
        },
      });
      expect(result).toEqual(mockAuditLog);
    });
  });

  describe('getAuditLogs', () => {
    it('should return audit logs with filters', async () => {
      const mockLogs = [
        {
          id: 'audit-1',
          adminId: 'admin-1',
          action: AuditAction.USER_BANNED,
          admin: { id: 'admin-1', email: 'admin@test.com' },
        },
      ];

      prisma.auditLog.findMany.mockResolvedValue(mockLogs);
      prisma.auditLog.count.mockResolvedValue(1);

      const result = await service.getAuditLogs({
        adminId: 'admin-1',
        action: AuditAction.USER_BANNED,
        limit: 10,
        offset: 0,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          adminId: 'admin-1',
          action: AuditAction.USER_BANNED,
        },
        include: {
          admin: {
            select: { id: true, email: true, nombre: true, apellido: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 0,
      });
      expect(result.logs).toEqual(mockLogs);
      expect(result.total).toBe(1);
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.getAuditLogs({
        startDate,
        endDate,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
      );
    });

    it('should use default limit of 50 when not specified', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.getAuditLogs({});

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          skip: 0,
        }),
      );
    });
  });

  describe('getAuditLogsForTarget', () => {
    it('should return logs for specific target', async () => {
      const mockLogs = [
        {
          id: 'audit-1',
          targetType: 'User',
          targetId: 'user-1',
          admin: { id: 'admin-1', email: 'admin@test.com' },
        },
      ];

      prisma.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getAuditLogsForTarget('User', 'user-1');

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { targetType: 'User', targetId: 'user-1' },
        include: {
          admin: { select: { id: true, email: true, nombre: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockLogs);
    });
  });

  describe('logUserBan', () => {
    it('should log user ban action', async () => {
      const mockAuditLog = { id: 'audit-1' };
      prisma.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await service.logUserBan(
        'admin-1',
        'user-1',
        'Fraud detected',
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-1',
          action: AuditAction.USER_BANNED,
          targetType: 'User',
          targetId: 'user-1',
          reason: 'Fraud detected',
          details: undefined,
        },
      });
      expect(result).toEqual(mockAuditLog);
    });
  });

  describe('logUserUnban', () => {
    it('should log user unban action', async () => {
      const mockAuditLog = { id: 'audit-1' };
      prisma.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await service.logUserUnban(
        'admin-1',
        'user-1',
        'Appeal approved',
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-1',
          action: AuditAction.USER_UNBANNED,
          targetType: 'User',
          targetId: 'user-1',
          reason: 'Appeal approved',
          details: undefined,
        },
      });
      expect(result).toEqual(mockAuditLog);
    });
  });

  describe('logRaffleHidden', () => {
    it('should log raffle hidden action', async () => {
      const mockAuditLog = { id: 'audit-1' };
      prisma.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await service.logRaffleHidden(
        'admin-1',
        'raffle-1',
        'Violates terms',
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-1',
          action: AuditAction.RAFFLE_HIDDEN,
          targetType: 'Raffle',
          targetId: 'raffle-1',
          reason: 'Violates terms',
          details: undefined,
        },
      });
      expect(result).toEqual(mockAuditLog);
    });
  });

  describe('logDisputeResolved', () => {
    it('should log dispute resolution with details', async () => {
      const mockAuditLog = { id: 'audit-1' };
      prisma.auditLog.create.mockResolvedValue(mockAuditLog);

      const details = { refundAmount: 1000, resolution: 'BUYER_FAVOR' };
      const result = await service.logDisputeResolved(
        'admin-1',
        'dispute-1',
        'Refund approved',
        details,
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-1',
          action: AuditAction.DISPUTE_RESOLVED,
          targetType: 'Dispute',
          targetId: 'dispute-1',
          reason: 'Refund approved',
          details,
        },
      });
      expect(result).toEqual(mockAuditLog);
    });
  });

  describe('logPayoutReleased', () => {
    it('should log payout release', async () => {
      const mockAuditLog = { id: 'audit-1' };
      prisma.auditLog.create.mockResolvedValue(mockAuditLog);

      const details = { amount: 5000, paymentMethod: 'MP' };
      const result = await service.logPayoutReleased(
        'admin-1',
        'payout-1',
        details,
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-1',
          action: AuditAction.PAYOUT_RELEASED,
          targetType: 'Payout',
          targetId: 'payout-1',
          details,
          reason: undefined,
        },
      });
      expect(result).toEqual(mockAuditLog);
    });
  });

  describe('logRefundIssued', () => {
    it('should log refund issuance', async () => {
      const mockAuditLog = { id: 'audit-1' };
      prisma.auditLog.create.mockResolvedValue(mockAuditLog);

      const details = { amount: 1500, ticketId: 'ticket-1' };
      const result = await service.logRefundIssued(
        'admin-1',
        'transaction-1',
        'Raffle cancelled',
        details,
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-1',
          action: AuditAction.REFUND_ISSUED,
          targetType: 'Transaction',
          targetId: 'transaction-1',
          reason: 'Raffle cancelled',
          details,
        },
      });
      expect(result).toEqual(mockAuditLog);
    });
  });
});

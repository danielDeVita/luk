import { Test, TestingModule } from '@nestjs/testing';
import { ReportsResolver } from './reports.resolver';
import { ReportsService } from './reports.service';
import { User } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

type MockReportsService = {
  createReport: jest.Mock;
  getReports: jest.Mock;
  reviewReport: jest.Mock;
  unhideRaffle: jest.Mock;
};

type MockAuditService = {
  logReportReviewed: jest.Mock;
  logRaffleHidden: jest.Mock;
  logRaffleUnhidden: jest.Mock;
};

describe('ReportsResolver', () => {
  let resolver: ReportsResolver;
  let service: MockReportsService;
  let audit: MockAuditService;

  const mockReportsService = (): MockReportsService => ({
    createReport: jest.fn(),
    getReports: jest.fn(),
    reviewReport: jest.fn(),
    unhideRaffle: jest.fn(),
  });

  const mockAuditService = (): MockAuditService => ({
    logReportReviewed: jest.fn(),
    logRaffleHidden: jest.fn(),
    logRaffleUnhidden: jest.fn(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsResolver,
        { provide: ReportsService, useValue: mockReportsService() },
        { provide: AuditService, useValue: mockAuditService() },
      ],
    }).compile();

    resolver = module.get<ReportsResolver>(ReportsResolver);
    service = module.get(ReportsService) as unknown as MockReportsService;
    audit = module.get(AuditService) as unknown as MockAuditService;
  });

  describe('reportRaffle', () => {
    it('should create a raffle report', async () => {
      const mockUser = { id: 'user-1', email: 'user@test.com' } as User;

      service.createReport.mockResolvedValue(undefined);

      const result = await resolver.reportRaffle(
        mockUser,
        'raffle-1',
        'Contenido inapropiado',
      );

      expect(service.createReport).toHaveBeenCalledWith(
        'user-1',
        'raffle-1',
        'Contenido inapropiado',
      );
      expect(result).toBe(true);
    });

    it('should handle different report reasons', async () => {
      const mockUser = { id: 'user-2', email: 'user2@test.com' } as User;

      service.createReport.mockResolvedValue(undefined);

      await resolver.reportRaffle(
        mockUser,
        'raffle-2',
        'Posible estafa - precio demasiado bajo',
      );

      expect(service.createReport).toHaveBeenCalledWith(
        'user-2',
        'raffle-2',
        'Posible estafa - precio demasiado bajo',
      );
    });
  });

  describe('getReports', () => {
    it('should return all reports as JSON string (admin only)', async () => {
      const mockReports = [
        {
          id: 'report-1',
          raffleId: 'raffle-1',
          userId: 'user-1',
          reason: 'Spam',
          reviewed: false,
        },
        {
          id: 'report-2',
          raffleId: 'raffle-2',
          userId: 'user-2',
          reason: 'Fraude',
          reviewed: false,
        },
      ];

      service.getReports.mockResolvedValue(mockReports);

      const result = await resolver.getReports();

      expect(service.getReports).toHaveBeenCalledWith({
        reviewed: undefined,
        raffleId: undefined,
      });
      expect(result).toBe(JSON.stringify(mockReports));
    });

    it('should filter reports by reviewed status', async () => {
      const mockReports = [
        {
          id: 'report-3',
          raffleId: 'raffle-3',
          reviewed: true,
          action: 'DISMISS',
        },
      ];

      service.getReports.mockResolvedValue(mockReports);

      const result = await resolver.getReports(true);

      expect(service.getReports).toHaveBeenCalledWith({
        reviewed: true,
        raffleId: undefined,
      });
      expect(result).toBe(JSON.stringify(mockReports));
    });

    it('should filter reports by raffleId', async () => {
      const mockReports = [
        {
          id: 'report-4',
          raffleId: 'raffle-specific',
          reviewed: false,
        },
      ];

      service.getReports.mockResolvedValue(mockReports);

      const result = await resolver.getReports(undefined, 'raffle-specific');

      expect(service.getReports).toHaveBeenCalledWith({
        reviewed: undefined,
        raffleId: 'raffle-specific',
      });
      expect(result).toBe(JSON.stringify(mockReports));
    });
  });

  describe('reviewReport', () => {
    it('should dismiss a report', async () => {
      const admin = { id: 'admin-1' } as User;
      service.reviewReport.mockResolvedValue({
        raffleId: 'raffle-1',
        sellerId: 'seller-1',
      });

      const result = await resolver.reviewReport(
        admin,
        'report-1',
        'Revisado - no hay problema',
        'DISMISS',
      );

      expect(service.reviewReport).toHaveBeenCalledWith(
        'report-1',
        'Revisado - no hay problema',
        'DISMISS',
      );
      expect(audit.logReportReviewed).toHaveBeenCalledWith(
        'admin-1',
        'report-1',
        {
          reportAction: 'DISMISS',
          adminNotes: 'Revisado - no hay problema',
          raffleId: 'raffle-1',
          sellerId: 'seller-1',
        },
      );
      expect(result).toBe(true);
    });

    it('should hide raffle based on report', async () => {
      const admin = { id: 'admin-1' } as User;
      service.reviewReport.mockResolvedValue({
        raffleId: 'raffle-2',
        sellerId: 'seller-2',
      });

      const result = await resolver.reviewReport(
        admin,
        'report-2',
        'Contenido violó términos de servicio',
        'HIDE_RAFFLE',
      );

      expect(service.reviewReport).toHaveBeenCalledWith(
        'report-2',
        'Contenido violó términos de servicio',
        'HIDE_RAFFLE',
      );
      expect(audit.logRaffleHidden).toHaveBeenCalledWith(
        'admin-1',
        'raffle-2',
        'Contenido violó términos de servicio',
      );
      expect(result).toBe(true);
    });

    it('should ban seller based on report', async () => {
      const admin = { id: 'admin-1' } as User;
      service.reviewReport.mockResolvedValue({
        raffleId: 'raffle-3',
        sellerId: 'seller-3',
      });

      const result = await resolver.reviewReport(
        admin,
        'report-3',
        'Vendedor fraudulento - múltiples reportes',
        'BAN_SELLER',
      );

      expect(service.reviewReport).toHaveBeenCalledWith(
        'report-3',
        'Vendedor fraudulento - múltiples reportes',
        'BAN_SELLER',
      );
      expect(result).toBe(true);
    });
  });

  describe('unhideRaffle', () => {
    it('should unhide a previously hidden raffle', async () => {
      const admin = { id: 'admin-1' } as User;
      service.unhideRaffle.mockResolvedValue(undefined);

      const result = await resolver.unhideRaffle(
        admin,
        'raffle-1',
        'Apelación aprobada - vendedor proporcionó evidencia',
      );

      expect(service.unhideRaffle).toHaveBeenCalledWith(
        'raffle-1',
        'Apelación aprobada - vendedor proporcionó evidencia',
      );
      expect(audit.logRaffleUnhidden).toHaveBeenCalledWith(
        'admin-1',
        'raffle-1',
        'Apelación aprobada - vendedor proporcionó evidencia',
      );
      expect(result).toBe(true);
    });
  });
});

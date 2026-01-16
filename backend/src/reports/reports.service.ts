import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly AUTO_HIDE_THRESHOLD = 3; // Hide raffle after 3 reports

  constructor(private prisma: PrismaService) {}

  /**
   * Create a report for a raffle
   * Only allows reporting active raffles
   */
  async createReport(userId: string, raffleId: string, reason: string) {
    // Check if raffle exists and is active
    const raffle = await this.prisma.raffle.findUnique({
      where: { id: raffleId },
      select: { id: true, estado: true, sellerId: true, isHidden: true },
    });

    if (!raffle) {
      throw new NotFoundException('Rifa no encontrada');
    }

    if (raffle.sellerId === userId) {
      throw new BadRequestException('No puedes reportar tu propia rifa');
    }

    if (raffle.estado !== 'ACTIVA') {
      throw new BadRequestException('Solo puedes reportar rifas activas');
    }

    // Check if user already reported this raffle
    const existingReport = await this.prisma.report.findUnique({
      where: {
        raffleId_reporterId: {
          raffleId,
          reporterId: userId,
        },
      },
    });

    if (existingReport) {
      throw new BadRequestException('Ya has reportado esta rifa');
    }

    // Create the report
    const report = await this.prisma.report.create({
      data: {
        raffleId,
        reporterId: userId,
        reason,
      },
    });

    // Check if raffle should be auto-hidden
    await this.checkAndHideRaffle(raffleId);

    this.logger.log(`Report created for raffle ${raffleId} by user ${userId}`);

    return report;
  }

  /**
   * Check if a raffle has too many reports and should be hidden
   */
  private async checkAndHideRaffle(raffleId: string) {
    const reportCount = await this.prisma.report.count({
      where: { raffleId, reviewed: false },
    });

    if (reportCount >= this.AUTO_HIDE_THRESHOLD) {
      await this.prisma.raffle.update({
        where: { id: raffleId },
        data: {
          isHidden: true,
          hiddenReason: `Auto-hidden: ${reportCount} reports received`,
        },
      });

      this.logger.warn(
        `Raffle ${raffleId} auto-hidden due to ${reportCount} reports`,
      );
    }
  }

  /**
   * Get all reports for admin review
   */
  async getReports(filters: { reviewed?: boolean; raffleId?: string }) {
    return this.prisma.report.findMany({
      where: {
        reviewed: filters.reviewed,
        raffleId: filters.raffleId,
      },
      include: {
        raffle: { select: { id: true, titulo: true, isHidden: true } },
        reporter: { select: { id: true, email: true, nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Review a report (admin only)
   */
  async reviewReport(
    reportId: string,
    adminNotes: string,
    action: 'DISMISS' | 'HIDE_RAFFLE' | 'BAN_SELLER',
  ) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: { raffle: { include: { seller: true } } },
    });

    if (!report) {
      throw new NotFoundException('Reporte no encontrado');
    }

    // Update report as reviewed
    await this.prisma.report.update({
      where: { id: reportId },
      data: {
        reviewed: true,
        reviewedAt: new Date(),
        adminNotes,
      },
    });

    // Take action based on decision
    if (action === 'HIDE_RAFFLE') {
      await this.prisma.raffle.update({
        where: { id: report.raffleId },
        data: {
          isHidden: true,
          hiddenReason: `Hidden by admin: ${adminNotes}`,
        },
      });
    } else if (action === 'BAN_SELLER') {
      await this.prisma.user.update({
        where: { id: report.raffle.sellerId },
        data: { role: 'BANNED' },
      });
      // Hide all their raffles
      await this.prisma.raffle.updateMany({
        where: { sellerId: report.raffle.sellerId },
        data: { isHidden: true, hiddenReason: 'Seller banned' },
      });
    }

    this.logger.log(`Report ${reportId} reviewed with action: ${action}`);

    return { success: true, action };
  }

  /**
   * Unhide a raffle (admin only)
   */
  async unhideRaffle(raffleId: string, adminNotes: string) {
    await this.prisma.raffle.update({
      where: { id: raffleId },
      data: {
        isHidden: false,
        hiddenReason: null,
      },
    });

    // Mark all reports for this raffle as reviewed
    await this.prisma.report.updateMany({
      where: { raffleId, reviewed: false },
      data: {
        reviewed: true,
        reviewedAt: new Date(),
        adminNotes: `Raffle unhidden: ${adminNotes}`,
      },
    });

    return { success: true };
  }
}

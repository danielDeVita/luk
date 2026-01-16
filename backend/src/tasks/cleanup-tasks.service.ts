import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CleanupTasksService {
  private readonly logger = new Logger(CleanupTasksService.name);
  private readonly cronEnabled: boolean;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.cronEnabled = this.configService.get<string>('ENABLE_CRON_JOBS') !== 'false';
  }

  /**
   * Daily at 3 AM - Cleanup and maintenance tasks
   */
  @Cron('0 3 * * *') // 3:00 AM every day
  async dailyCleanup() {
    if (!this.cronEnabled) return;
    
    this.logger.log('Starting: Daily cleanup tasks');

    try {
      await this.cleanupExpiredReservedTickets();
      await this.sendShippingReminders();
      this.logger.log('Finished: Daily cleanup tasks');
    } catch (error) {
      this.logger.error('Error in daily cleanup:', error instanceof Error ? error.stack : error);
    }
  }

  /**
   * Every 10 minutes - Clean expired reserved tickets
   * Reserved tickets that weren't paid within 30 minutes should be released
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanupExpiredReservedTickets() {
    if (!this.cronEnabled) return;

    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

    const result = await this.prisma.ticket.deleteMany({
      where: {
        estado: 'RESERVADO',
        createdAt: { lte: thirtyMinutesAgo },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired reserved tickets`);
    }
  }

  /**
   * Send reminders to sellers who need to ship within 24h after sorteo
   */
  private async sendShippingReminders() {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

    const raffles = await this.prisma.raffle.findMany({
      where: {
        estado: 'SORTEADA',
        fechaSorteoReal: {
          gte: fortyEightHoursAgo,
          lte: twentyFourHoursAgo,
        },
        deliveryStatus: 'PENDING',
        shippedAt: null,
        isDeleted: false,
      },
      include: { seller: true, winner: true },
    });

    for (const raffle of raffles) {
      this.logger.log(`Reminder: Seller ${raffle.sellerId} needs to ship raffle ${raffle.id}`);
      // In production, would send notification here
    }

    this.logger.log(`Sent ${raffles.length} shipping reminders`);
  }
}

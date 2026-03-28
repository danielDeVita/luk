import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SocialPromotionsService } from '../social-promotions/social-promotions.service';
import { captureException } from '../sentry';

function isFalseEnvFlag(value: boolean | string | undefined): boolean {
  return (
    value === false ||
    (typeof value === 'string' && value.trim().toLowerCase() === 'false')
  );
}

@Injectable()
export class CleanupTasksService {
  private readonly logger = new Logger(CleanupTasksService.name);
  private readonly cronEnabled: boolean;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private socialPromotionsService: SocialPromotionsService,
  ) {
    const cronFlag = this.configService.get<boolean | string>(
      'ENABLE_CRON_JOBS',
    );
    this.cronEnabled = !isFalseEnvFlag(cronFlag);
  }

  /**
   * Daily at 3 AM - Cleanup and maintenance tasks
   */
  @Cron('0 3 * * *')
  async dailyCleanup() {
    if (!this.cronEnabled) return;

    this.logger.log('Starting: Daily cleanup tasks');

    try {
      await this.cleanupExpiredReservedTickets();
      await this.sendShippingReminders();
      this.logger.log('Finished: Daily cleanup tasks');
    } catch (error) {
      this.logger.error(
        'Error in daily cleanup:',
        error instanceof Error ? error.stack : error,
      );
      captureException(
        error instanceof Error ? error : new Error('Error in daily cleanup'),
        {
          tags: {
            service: 'luk-backend',
            domain: 'raffles',
            stage: 'cron',
          },
        },
      );
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

    const expiredReservations = await this.prisma.ticket.findMany({
      where: {
        estado: 'RESERVADO',
        createdAt: { lte: thirtyMinutesAgo },
        mpExternalReference: { not: null },
      },
      select: { mpExternalReference: true },
      distinct: ['mpExternalReference'],
    });

    const result = await this.prisma.ticket.deleteMany({
      where: {
        estado: 'RESERVADO',
        createdAt: { lte: thirtyMinutesAgo },
      },
    });

    for (const reservation of expiredReservations) {
      if (reservation.mpExternalReference) {
        await this.socialPromotionsService.releaseReservedRedemptionByReservation(
          reservation.mpExternalReference,
        );
      }
    }

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
      this.logger.log(
        `Reminder: Seller ${raffle.sellerId} needs to ship raffle ${raffle.id}`,
      );
      // In production, would send notification here
    }

    this.logger.log(`Sent ${raffles.length} shipping reminders`);
  }
}

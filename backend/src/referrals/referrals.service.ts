import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReferralCreditStatus, ReferralCreditType } from '@prisma/client';

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);
  private readonly REFERRER_BONUS_PERCENT = 0.05; // 5% of first purchase

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /**
   * Generate a unique 8-character referral code for a user.
   */
  async generateReferralCode(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true, nombre: true, apellido: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // If user already has a code, return it
    if (user.referralCode) {
      return user.referralCode;
    }

    // Generate a unique code: first 2 letters of name + 6 random chars
    const prefix = (user.nombre.substring(0, 2) + user.apellido.substring(0, 2))
      .toUpperCase()
      .replace(/[^A-Z]/g, 'X');

    let code: string;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
      code = `${prefix}${randomPart}`;

      const existing = await this.prisma.user.findUnique({
        where: { referralCode: code },
      });

      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      // Fallback to fully random code
      code = Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { referralCode: code! },
    });

    this.logger.log(`Generated referral code ${code!} for user ${userId}`);
    return code!;
  }

  /**
   * Apply a referral code to a user (typically during registration).
   */
  async applyReferralCode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referredById: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.referredById) {
      throw new BadRequestException('Ya tenés un código de referido aplicado');
    }

    // Find the referrer by code
    const referrer = await this.prisma.user.findUnique({
      where: { referralCode: code.toUpperCase() },
      select: { id: true, nombre: true, email: true },
    });

    if (!referrer) {
      throw new BadRequestException('Código de referido inválido');
    }

    if (referrer.id === userId) {
      throw new BadRequestException('No podés usar tu propio código de referido');
    }

    // Link the user to the referrer
    await this.prisma.user.update({
      where: { id: userId },
      data: { referredById: referrer.id },
    });

    this.logger.log(`User ${userId} applied referral code ${code} from referrer ${referrer.id}`);
    return true;
  }

  /**
   * Process referral reward when a referred user makes their first purchase.
   * Called from TicketsService after successful payment.
   */
  async processFirstPurchaseReward(refereeId: string, purchaseAmount: number, ticketId?: string): Promise<void> {
    const referee = await this.prisma.user.findUnique({
      where: { id: refereeId },
      select: { referredById: true, nombre: true },
    });

    if (!referee || !referee.referredById) {
      this.logger.debug(`User ${refereeId} has no referrer, skipping reward`);
      return;
    }

    // Check if a reward was already given for this referee
    const existingReward = await this.prisma.referralCredit.findFirst({
      where: {
        refereeId,
        type: ReferralCreditType.FIRST_PURCHASE_BONUS,
      },
    });

    if (existingReward) {
      this.logger.debug(`Referral reward already processed for referee ${refereeId}`);
      return;
    }

    const referrer = await this.prisma.user.findUnique({
      where: { id: referee.referredById },
      select: { id: true, nombre: true, email: true, referralBalance: true },
    });

    if (!referrer) {
      this.logger.warn(`Referrer ${referee.referredById} not found for referee ${refereeId}`);
      return;
    }

    // Calculate reward (5% of purchase amount)
    const rewardAmount = Math.round(purchaseAmount * this.REFERRER_BONUS_PERCENT * 100) / 100;

    // Create referral credit and update balance in a transaction
    await this.prisma.$transaction([
      this.prisma.referralCredit.create({
        data: {
          userId: referrer.id,
          refereeId,
          amount: rewardAmount,
          type: ReferralCreditType.FIRST_PURCHASE_BONUS,
          status: ReferralCreditStatus.CREDITED,
          description: `Bonificación por primera compra de ${referee.nombre}`,
          ticketId,
          processedAt: new Date(),
        },
      }),
      this.prisma.user.update({
        where: { id: referrer.id },
        data: {
          referralBalance: { increment: rewardAmount },
        },
      }),
    ]);

    // Notify referrer (non-blocking)
    this.notifications.sendReferralRewardNotification(referrer.email, {
      refereeName: referee.nombre,
      amount: rewardAmount,
      totalBalance: Number(referrer.referralBalance) + rewardAmount,
    }).catch((err) => {
      this.logger.error(`Failed to send referral reward notification: ${err.message}`);
    });

    this.notifications.create(
      referrer.id,
      'INFO',
      '💰 ¡Ganaste crédito de referido!',
      `${referee.nombre} hizo su primera compra. Ganaste $${rewardAmount.toFixed(2)} de crédito.`,
    ).catch((err) => {
      this.logger.error(`Failed to create in-app notification: ${err.message}`);
    });

    this.logger.log(`Processed referral reward: $${rewardAmount} for referrer ${referrer.id} from referee ${refereeId}`);
  }

  /**
   * Get referral statistics for a user.
   */
  async getReferralStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true, referralBalance: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Count referred users
    const totalReferred = await this.prisma.user.count({
      where: { referredById: userId },
    });

    // Sum credited amounts
    const credits = await this.prisma.referralCredit.aggregate({
      where: { userId, status: ReferralCreditStatus.CREDITED },
      _sum: { amount: true },
    });

    // Sum pending amounts
    const pending = await this.prisma.referralCredit.aggregate({
      where: { userId, status: ReferralCreditStatus.PENDING },
      _sum: { amount: true },
    });

    return {
      referralCode: user.referralCode,
      totalReferred,
      totalEarned: Number(credits._sum.amount || 0),
      pendingCredits: Number(pending._sum.amount || 0),
      availableBalance: Number(user.referralBalance),
    };
  }

  /**
   * Get list of referred users with their contribution status.
   */
  async getReferredUsers(userId: string) {
    const referredUsers = await this.prisma.user.findMany({
      where: { referredById: userId },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get credits for each referred user
    const credits = await this.prisma.referralCredit.findMany({
      where: { userId },
      select: { refereeId: true, amount: true, status: true },
    });

    return referredUsers.map((user) => {
      const userCredits = credits.filter((c) => c.refereeId === user.id);
      const earnedFromUser = userCredits
        .filter((c) => c.status === ReferralCreditStatus.CREDITED)
        .reduce((sum, c) => sum + Number(c.amount), 0);

      return {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        createdAt: user.createdAt,
        hasPurchased: userCredits.length > 0,
        earnedFromUser,
      };
    });
  }

  /**
   * Get user's referral credits history.
   */
  async getReferralCredits(userId: string) {
    return this.prisma.referralCredit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get user's referral code (without generating if doesn't exist).
   */
  async getReferralCode(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });

    return user?.referralCode || null;
  }
}

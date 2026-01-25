import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PubSub } from 'graphql-subscriptions';
import { PrismaService } from '../prisma/prisma.service';
import {
  getDeliveryReminderToWinnerContent,
  getDisputeOpenedToBuyerContent,
  getDisputeOpenedToSellerContent,
  getDisputeResolvedNotificationContent,
  getEmailVerificationCodeContent,
  getPaymentWillBeReleasedNotificationContent,
  getPriceDropAlertContent,
  getPriceReductionSuggestionContent,
  getRaffleCancelledNotificationContent,
  getRaffleCompletedNotificationContent,
  getRaffleParticipantNotificationContent,
  getReferralRewardNotificationContent,
  getRefundDueToDisputeNotificationContent,
  getRefundNotificationContent,
  getSellerMustContactWinnerContent,
  getSellerMustRespondDisputeContent,
  getSellerPaymentNotificationContent,
  getStripeConnectSuccessNotificationContent,
  getTicketPurchaseConfirmationContent,
  getWelcomeEmailContent,
  getWelcomeWithReferralBonusEmailContent,
  getWinnerNotificationContent,
} from './email-templates';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * NotificationsService - Handles all email communications
 * Uses Nodemailer (Gmail/SMTP) for email delivery
 */

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly isProduction: boolean;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {
    this.fromEmail =
      this.configService.get<string>('EMAIL_FROM') || 'noreply@rifas.app';
    this.fromName =
      this.configService.get<string>('EMAIL_FROM_NAME') ||
      'Plataforma de Rifas';

    // Check if we have SMTP credentials
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    this.isProduction = !!smtpUser && !!smtpPass && smtpUser !== 'mock';

    if (this.isProduction) {
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('SMTP_HOST') || 'smtp.gmail.com',
        port: parseInt(this.configService.get<string>('SMTP_PORT') || '465'),
        secure: this.configService.get<string>('SMTP_SECURE') === 'true', // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      this.logger.log('✅ Nodemailer service initialized');
    } else {
      this.transporter = null;
      this.logger.warn(
        '⚠️ Email service in MOCK mode (no SMTP_USER/SMTP_PASS)',
      );
    }
  }

  // ==================== In-App Notifications ====================

  async create(userId: string, type: string, title: string, message: string) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
      },
    });

    await this.pubSub.publish('notificationAdded', {
      notificationAdded: notification,
    });

    return notification;
  }

  async findAll(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  // ==================== Core Email Method ====================

  private async sendEmail(options: EmailOptions): Promise<boolean> {
    const from = `"${this.fromName}" <${this.fromEmail}>`;

    if (this.transporter && this.isProduction) {
      try {
        const info = await this.transporter.sendMail({
          from,
          to: options.to,
          subject: options.subject,
          html: options.html,
        });

        this.logger.log(
          `📧 Email sent: ${options.subject} -> ${options.to} (ID: ${info.messageId})`,
        );
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Email error: ${message}`);
        return false;
      }
    } else {
      // Mock mode - log email content
      this.logger.log(`📧 [MOCK] Email to: ${options.to}`);
      this.logger.log(`   Subject: ${options.subject}`);
      this.logger.debug(
        `   Body preview: ${options.html.substring(0, 150)}...`,
      );
      return true;
    }
  }

  // ==================== Auth Notifications ====================

  async sendWelcomeEmail(email: string, data: { userName: string }) {
    const html = getWelcomeEmailContent(data, this.configService);
    return this.sendEmail({
      to: email,
      subject: '¡Bienvenido a la Plataforma de Rifas!',
      html,
    });
  }

  async sendEmailVerificationCode(
    email: string,
    data: { userName: string; code: string; expiresInMinutes: number },
  ) {
    const html = getEmailVerificationCodeContent(data, this.configService);
    return this.sendEmail({
      to: email,
      subject: 'Verificá tu email - Código de confirmación',
      html,
    });
  }

  // ==================== Raffle Notifications ====================

  async sendTicketPurchaseConfirmation(
    email: string,
    data: { raffleName: string; ticketNumbers: number[]; amount: number },
  ) {
    const html = getTicketPurchaseConfirmationContent(data, this.configService);
    return this.sendEmail({
      to: email,
      subject: `✅ Confirmación de compra - ${data.raffleName}`,
      html,
    });
  }

  async sendRaffleCompletedNotification(
    email: string,
    data: { raffleName: string },
  ) {
    const html = getRaffleCompletedNotificationContent(
      data,
      this.configService,
    );
    return this.sendEmail({
      to: email,
      subject: `🎯 Rifa completada - ${data.raffleName}`,
      html,
    });
  }

  async sendWinnerNotification(
    email: string,
    data: { raffleName: string; productName: string; sellerEmail: string },
  ) {
    const html = getWinnerNotificationContent(data, this.configService);
    return this.sendEmail({
      to: email,
      subject: `🎉 ¡GANASTE! - ${data.raffleName}`,
      html,
    });
  }

  async sendRaffleParticipantNotification(
    email: string,
    data: { raffleName: string; winnerName: string },
  ) {
    const html = getRaffleParticipantNotificationContent(
      data,
      this.configService,
    );
    return this.sendEmail({
      to: email,
      subject: `Resultado del sorteo - ${data.raffleName}`,
      html,
    });
  }

  async sendRefundNotification(
    email: string,
    data: { raffleName: string; amount: number; reason: string },
  ) {
    const html = getRefundNotificationContent(data, this.configService);
    return this.sendEmail({
      to: email,
      subject: `💰 Reembolso procesado - ${data.raffleName}`,
      html,
    });
  }

  async sendSellerPaymentNotification(
    email: string,
    data: { raffleName: string; amount: number; fees: number },
  ) {
    const html = getSellerPaymentNotificationContent(data, this.configService);
    return this.sendEmail({
      to: email,
      subject: `💰 Pago recibido - ${data.raffleName}`,
      html,
    });
  }

  async sendPriceReductionSuggestion(
    email: string,
    data: {
      raffleName: string;
      currentPrice: number;
      suggestedPrice: number;
      percentageSold: number;
      raffleId: string;
      priceReductionId: string;
    },
  ) {
    const html = getPriceReductionSuggestionContent(data, this.configService);
    return this.sendEmail({
      to: email,
      subject: `📉 Sugerencia de precio - ${data.raffleName}`,
      html,
    });
  }

  async sendRaffleCancelledNotification(
    email: string,
    data: { raffleName: string; reason: string },
  ) {
    const html = getRaffleCancelledNotificationContent(
      data,
      this.configService,
    );
    return this.sendEmail({
      to: email,
      subject: `❌ Rifa cancelada - ${data.raffleName}`,
      html,
    });
  }

  // ==================== Delivery Notifications ====================

  async sendSellerMustContactWinner(
    email: string,
    data: { raffleName: string; winnerEmail: string },
  ) {
    const html = getSellerMustContactWinnerContent(data, this.configService);
    return this.sendEmail({
      to: email,
      subject: `🚀 ¡Acción requerida! Contacta al ganador - ${data.raffleName}`,
      html,
    });
  }

  async sendDeliveryReminderToWinner(
    email: string,
    data: { raffleName: string; daysSinceShipped: number },
  ) {
    const html = getDeliveryReminderToWinnerContent(data, this.configService);
    return this.sendEmail({
      to: email,
      subject: `📦 ¿Recibiste tu producto? - ${data.raffleName}`,
      html,
    });
  }

  async sendPaymentWillBeReleasedNotification(
    email: string,
    data: { raffleName: string; daysRemaining: number },
  ) {
    const html = getPaymentWillBeReleasedNotificationContent(
      data,
      this.configService,
    );
    return this.sendEmail({
      to: email,
      subject: `⏰ Pago próximo a liberarse - ${data.raffleName}`,
      html,
    });
  }

  // ==================== Dispute Notifications ====================

  async sendDisputeOpenedToSeller(
    email: string,
    data: { raffleName: string; disputeType: string; disputeTitle: string },
  ) {
    const html = getDisputeOpenedToSellerContent(data, this.configService);
    return this.sendEmail({
      to: email,
      subject: `⚠️ Disputa abierta - ${data.raffleName}`,
      html,
    });
  }

  async sendDisputeOpenedToBuyer(
    email: string,
    data: { raffleName: string; disputeId: string },
  ) {
    const html = getDisputeOpenedToBuyerContent(data, this.configService);
    return this.sendEmail({
      to: email,
      subject: `📝 Disputa registrada - ${data.raffleName}`,
      html,
    });
  }

  async sendSellerMustRespondDispute(
    email: string,
    data: { raffleName: string; hoursRemaining: number },
  ) {
    const html = getSellerMustRespondDisputeContent(data, this.configService);
    return this.sendEmail({
      to: email,
      subject: `⚠️ URGENTE: Responde la disputa - ${data.raffleName}`,
      html,
    });
  }

  async sendDisputeResolvedNotification(
    email: string,
    data: { raffleName: string; resolution: string; refundAmount?: number },
  ) {
    const html = getDisputeResolvedNotificationContent(
      data,
      this.configService,
    );
    return this.sendEmail({
      to: email,
      subject: `✅ Disputa resuelta - ${data.raffleName}`,
      html,
    });
  }

  async sendRefundDueToDisputeNotification(
    email: string,
    data: { raffleName: string; amount: number },
  ) {
    const html = getRefundDueToDisputeNotificationContent(
      data,
      this.configService,
    );
    return this.sendEmail({
      to: email,
      subject: `💰 Reembolso por disputa - ${data.raffleName}`,
      html,
    });
  }

  // ==================== Stripe Connect Notifications ====================

  async sendStripeConnectSuccessNotification(
    email: string,
    data: { userName: string },
  ) {
    const html = getStripeConnectSuccessNotificationContent(
      data,
      this.configService,
    );
    return this.sendEmail({
      to: email,
      subject: '✅ ¡Cuenta conectada!',
      html,
    });
  }

  // ==================== Price Alert Notifications ====================

  async sendPriceDropAlert(
    email: string,
    data: {
      raffleName: string;
      oldPrice: number;
      newPrice: number;
      dropPercent: number;
      raffleUrl: string;
    },
  ) {
    const html = getPriceDropAlertContent(data, this.configService);
    return this.sendEmail({
      to: email,
      subject: `📉 ¡Precio reducido! ${data.raffleName} ahora $${data.newPrice}`,
      html,
    });
  }

  // ==================== Referral Notifications ====================

  async sendReferralRewardNotification(
    email: string,
    data: { refereeName: string; amount: number; totalBalance: number },
  ) {
    const html = getReferralRewardNotificationContent(data, this.configService);
    return this.sendEmail({
      to: email,
      subject: `💰 ¡Ganaste $${data.amount.toFixed(2)} por referido!`,
      html,
    });
  }

  async sendWelcomeWithReferralBonusEmail(
    email: string,
    data: { userName: string; referrerName: string },
  ) {
    const html = getWelcomeWithReferralBonusEmailContent(
      data,
      this.configService,
    );
    return this.sendEmail({
      to: email,
      subject: '¡Bienvenido! Fuiste invitado por un amigo',
      html,
    });
  }
}

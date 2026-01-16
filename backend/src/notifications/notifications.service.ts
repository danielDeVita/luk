import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PubSub } from 'graphql-subscriptions';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * NotificationsService - Handles all email communications
 * Uses Resend for production email delivery
 */
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly isProduction: boolean;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    this.fromEmail = this.configService.get<string>('EMAIL_FROM') || 'onboarding@resend.dev';
    this.fromName = this.configService.get<string>('EMAIL_FROM_NAME') || 'Plataforma de Rifas';
    this.isProduction = !!resendApiKey && resendApiKey !== 'mock';

    if (this.isProduction) {
      this.resend = new Resend(resendApiKey);
      this.logger.log('✅ Resend email service initialized');
    } else {
      this.resend = null;
      this.logger.warn('⚠️ Email service in MOCK mode (no RESEND_API_KEY)');
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
    const from = `${this.fromName} <${this.fromEmail}>`;

    if (this.resend && this.isProduction) {
      try {
        const { data, error } = await this.resend.emails.send({
          from,
          to: options.to,
          subject: options.subject,
          html: options.html,
        });

        if (error) {
          this.logger.error(`Email send failed: ${error.message}`);
          return false;
        }

        this.logger.log(`📧 Email sent: ${options.subject} -> ${options.to} (ID: ${data?.id})`);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Email error: ${message}`);
        return false;
      }
    } else {
      // Mock mode - log email content
      this.logger.log(`📧 [MOCK] Email to: ${options.to}`);
      this.logger.log(`   Subject: ${options.subject}`);
      this.logger.debug(`   Body preview: ${options.html.substring(0, 150)}...`);
      return true;
    }
  }

  // ==================== Auth Notifications ====================

  async sendWelcomeEmail(
    email: string,
    data: { userName: string },
  ) {
    return this.sendEmail({
      to: email,
      subject: '¡Bienvenido a la Plataforma de Rifas!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">¡Bienvenido, ${data.userName}!</h1>
          <p>Tu cuenta ha sido creada exitosamente.</p>
          <p>Ahora puedes:</p>
          <ul>
            <li>Participar en rifas y ganar premios increíbles</li>
            <li>Crear tus propias rifas (conecta tu cuenta de Stripe)</li>
            <li>Gestionar tus tickets y premios</li>
          </ul>
          <div style="margin: 30px 0;">
            <a href="${this.configService.get('FRONTEND_URL') || 'http://localhost:3000'}" 
               style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Explorar Rifas
            </a>
          </div>
          <p style="color: #666; font-size: 12px;">
            Si no creaste esta cuenta, puedes ignorar este mensaje.
          </p>
        </div>
      `,
    });
  }

  async sendEmailVerificationCode(
    email: string,
    data: { userName: string; code: string; expiresInMinutes: number },
  ) {
    return this.sendEmail({
      to: email,
      subject: 'Verificá tu email - Código de confirmación',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">¡Hola ${data.userName}!</h1>
          <p>Para completar tu registro, ingresá este código:</p>
          <div style="background: #F3F4F6; padding: 24px; text-align: center; border-radius: 8px; margin: 24px 0;">
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4F46E5;">
              ${data.code}
            </div>
          </div>
          <p style="color: #666;">Este código expira en <strong>${data.expiresInMinutes} minutos</strong>.</p>
          <p style="color: #666; font-size: 12px; margin-top: 24px;">
            Si no solicitaste este código, podés ignorar este email.
          </p>
        </div>
      `,
    });
  }

  // ==================== Raffle Notifications ====================

  async sendTicketPurchaseConfirmation(
    email: string,
    data: { raffleName: string; ticketNumbers: number[]; amount: number },
  ) {
    return this.sendEmail({
      to: email,
      subject: `✅ Confirmación de compra - ${data.raffleName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10B981;">¡Compra confirmada!</h1>
          <p>Has comprado ${data.ticketNumbers.length} ticket(s) para la rifa:</p>
          <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin: 0 0 10px 0;">${data.raffleName}</h2>
            <p style="margin: 5px 0;"><strong>Números:</strong> ${data.ticketNumbers.join(', ')}</p>
            <p style="margin: 5px 0;"><strong>Total pagado:</strong> $${data.amount.toFixed(2)}</p>
          </div>
          <p>¡Buena suerte! 🍀</p>
        </div>
      `,
    });
  }

  async sendRaffleCompletedNotification(
    email: string,
    data: { raffleName: string },
  ) {
    return this.sendEmail({
      to: email,
      subject: `🎯 Rifa completada - ${data.raffleName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">¡Todos los tickets vendidos!</h1>
          <p>La rifa "${data.raffleName}" ha vendido todos sus tickets.</p>
          <p>El sorteo se realizará pronto. ¡Prepárate!</p>
        </div>
      `,
    });
  }

  async sendWinnerNotification(
    email: string,
    data: { raffleName: string; productName: string; sellerEmail: string },
  ) {
    return this.sendEmail({
      to: email,
      subject: `🎉 ¡GANASTE! - ${data.raffleName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 30px; background: linear-gradient(135deg, #4F46E5, #7C3AED); border-radius: 12px;">
            <h1 style="color: white; margin: 0;">🎉 ¡FELICITACIONES!</h1>
            <h2 style="color: white; margin: 10px 0 0 0;">¡Eres el ganador!</h2>
          </div>
          <div style="padding: 20px;">
            <p>Has ganado la rifa <strong>"${data.raffleName}"</strong>.</p>
            <div style="background: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Producto:</strong> ${data.productName}</p>
              <p style="margin: 5px 0;"><strong>Email del vendedor:</strong> ${data.sellerEmail}</p>
            </div>
            <p>El vendedor se pondrá en contacto contigo pronto para coordinar el envío.</p>
            <p style="color: #EF4444;"><strong>Importante:</strong> Tienes 7 días para confirmar la recepción del producto.</p>
          </div>
        </div>
      `,
    });
  }

  async sendRaffleParticipantNotification(
    email: string,
    data: { raffleName: string; winnerName: string },
  ) {
    return this.sendEmail({
      to: email,
      subject: `Resultado del sorteo - ${data.raffleName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Resultado del sorteo</h1>
          <p>La rifa "${data.raffleName}" ya tiene ganador.</p>
          <p>Lamentablemente no fuiste el ganador esta vez, pero puedes participar en otras rifas.</p>
          <p>¡Gracias por participar y suerte la próxima! 🍀</p>
        </div>
      `,
    });
  }

  async sendRefundNotification(
    email: string,
    data: { raffleName: string; amount: number; reason: string },
  ) {
    return this.sendEmail({
      to: email,
      subject: `💰 Reembolso procesado - ${data.raffleName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10B981;">Reembolso procesado</h1>
          <div style="background: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Monto:</strong> $${data.amount.toFixed(2)}</p>
            <p style="margin: 5px 0;"><strong>Rifa:</strong> ${data.raffleName}</p>
            <p style="margin: 5px 0;"><strong>Motivo:</strong> ${data.reason}</p>
          </div>
          <p>El dinero estará disponible en tu cuenta en 5-10 días hábiles.</p>
        </div>
      `,
    });
  }

  async sendSellerPaymentNotification(
    email: string,
    data: { raffleName: string; amount: number; fees: number },
  ) {
    return this.sendEmail({
      to: email,
      subject: `💰 Pago recibido - ${data.raffleName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10B981;">¡Pago recibido!</h1>
          <p>Has recibido el pago por tu rifa "${data.raffleName}".</p>
          <div style="background: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Monto bruto:</strong> $${(data.amount + data.fees).toFixed(2)}</p>
            <p style="margin: 5px 0;"><strong>Comisiones:</strong> $${data.fees.toFixed(2)}</p>
            <p style="margin: 5px 0; font-size: 18px;"><strong>Monto neto:</strong> $${data.amount.toFixed(2)}</p>
          </div>
        </div>
      `,
    });
  }

  async sendPriceReductionSuggestion(
    email: string,
    data: { raffleName: string; currentPrice: number; suggestedPrice: number; percentageSold: number },
  ) {
    return this.sendEmail({
      to: email,
      subject: `📉 Sugerencia de precio - ${data.raffleName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Sugerencia de reducción de precio</h1>
          <p>Tu rifa "${data.raffleName}" no alcanzó el mínimo de ventas.</p>
          <div style="background: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Vendido:</strong> ${(data.percentageSold * 100).toFixed(0)}%</p>
            <p style="margin: 5px 0;"><strong>Precio actual:</strong> $${data.currentPrice.toFixed(2)}</p>
            <p style="margin: 5px 0;"><strong>Precio sugerido:</strong> $${data.suggestedPrice.toFixed(2)}</p>
          </div>
          <p>Considera relanzar la rifa con el precio sugerido para aumentar ventas.</p>
        </div>
      `,
    });
  }

  async sendRaffleCancelledNotification(
    email: string,
    data: { raffleName: string; reason: string },
  ) {
    return this.sendEmail({
      to: email,
      subject: `❌ Rifa cancelada - ${data.raffleName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #EF4444;">Rifa cancelada</h1>
          <p>La rifa "${data.raffleName}" ha sido cancelada.</p>
          <p><strong>Motivo:</strong> ${data.reason}</p>
          <p>Si realizaste una compra, el reembolso se procesará automáticamente.</p>
        </div>
      `,
    });
  }

  // ==================== Delivery Notifications ====================

  async sendSellerMustContactWinner(
    email: string,
    data: { raffleName: string; winnerEmail: string },
  ) {
    return this.sendEmail({
      to: email,
      subject: `🚀 ¡Acción requerida! Contacta al ganador - ${data.raffleName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">¡Tu rifa tiene un ganador!</h1>
          <p>Tienes <strong>48 horas</strong> para contactar al ganador y coordinar el envío.</p>
          <div style="background: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Rifa:</strong> ${data.raffleName}</p>
            <p style="margin: 5px 0;"><strong>Email del ganador:</strong> ${data.winnerEmail}</p>
          </div>
          <p>No olvides marcar el envío en la plataforma cuando lo despaches.</p>
        </div>
      `,
    });
  }

  async sendDeliveryReminderToWinner(
    email: string,
    data: { raffleName: string; daysSinceShipped: number },
  ) {
    return this.sendEmail({
      to: email,
      subject: `📦 ¿Recibiste tu producto? - ${data.raffleName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Recordatorio de confirmación</h1>
          <p>Han pasado <strong>${data.daysSinceShipped} días</strong> desde que se envió tu producto.</p>
          <p>Por favor, confirma la recepción en la plataforma.</p>
          <p>Si hay algún problema con el producto, puedes abrir una disputa.</p>
        </div>
      `,
    });
  }

  async sendPaymentWillBeReleasedNotification(
    email: string,
    data: { raffleName: string; daysRemaining: number },
  ) {
    return this.sendEmail({
      to: email,
      subject: `⏰ Pago próximo a liberarse - ${data.raffleName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>El pago se liberará pronto</h1>
          <p>El pago por la rifa "${data.raffleName}" se liberará en <strong>${data.daysRemaining} días</strong>.</p>
          <p>Esto ocurrirá automáticamente si el ganador no confirma la recepción.</p>
        </div>
      `,
    });
  }

  // ==================== Dispute Notifications ====================

  async sendDisputeOpenedToSeller(
    email: string,
    data: { raffleName: string; disputeType: string; disputeTitle: string },
  ) {
    return this.sendEmail({
      to: email,
      subject: `⚠️ Disputa abierta - ${data.raffleName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #EF4444;">Se ha abierto una disputa</h1>
          <p>El ganador ha abierto una disputa por tu rifa "${data.raffleName}".</p>
          <div style="background: #FEE2E2; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Tipo:</strong> ${data.disputeType}</p>
            <p style="margin: 5px 0;"><strong>Título:</strong> ${data.disputeTitle}</p>
          </div>
          <p style="color: #EF4444;"><strong>Tienes 48 horas para responder.</strong></p>
          <p>El pago quedará retenido hasta la resolución.</p>
        </div>
      `,
    });
  }

  async sendDisputeOpenedToBuyer(
    email: string,
    data: { raffleName: string; disputeId: string },
  ) {
    return this.sendEmail({
      to: email,
      subject: `📝 Disputa registrada - ${data.raffleName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Tu disputa ha sido registrada</h1>
          <p>Hemos recibido tu disputa por la rifa "${data.raffleName}".</p>
          <div style="background: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>ID de disputa:</strong> ${data.disputeId}</p>
          </div>
          <p>El vendedor tiene 48 horas para responder. Te mantendremos informado.</p>
        </div>
      `,
    });
  }

  async sendSellerMustRespondDispute(
    email: string,
    data: { raffleName: string; hoursRemaining: number },
  ) {
    return this.sendEmail({
      to: email,
      subject: `⚠️ URGENTE: Responde la disputa - ${data.raffleName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #EF4444;">Responde la disputa</h1>
          <p>Te quedan <strong>${data.hoursRemaining} horas</strong> para responder la disputa.</p>
          <p style="color: #EF4444;">Si no respondes, la disputa podría resolverse automáticamente a favor del comprador.</p>
        </div>
      `,
    });
  }

  async sendDisputeResolvedNotification(
    email: string,
    data: { raffleName: string; resolution: string; refundAmount?: number },
  ) {
    return this.sendEmail({
      to: email,
      subject: `✅ Disputa resuelta - ${data.raffleName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10B981;">Disputa resuelta</h1>
          <p>La disputa por la rifa "${data.raffleName}" ha sido resuelta.</p>
          <div style="background: #D1FAE5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Resolución:</strong> ${data.resolution}</p>
            ${data.refundAmount ? `<p style="margin: 5px 0;"><strong>Reembolso:</strong> $${data.refundAmount.toFixed(2)}</p>` : ''}
          </div>
        </div>
      `,
    });
  }

  async sendRefundDueToDisputeNotification(
    email: string,
    data: { raffleName: string; amount: number },
  ) {
    return this.sendEmail({
      to: email,
      subject: `💰 Reembolso por disputa - ${data.raffleName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10B981;">Reembolso procesado</h1>
          <p>Se ha procesado un reembolso de <strong>$${data.amount.toFixed(2)}</strong> por la disputa.</p>
          <p>Rifa: ${data.raffleName}</p>
        </div>
      `,
    });
  }

  // ==================== Stripe Connect Notifications ====================

  async sendStripeConnectSuccessNotification(
    email: string,
    data: { userName: string },
  ) {
    return this.sendEmail({
      to: email,
      subject: '✅ ¡Cuenta de Stripe conectada!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10B981;">¡Listo para vender!</h1>
          <p>Hola ${data.userName},</p>
          <p>Tu cuenta de Stripe ha sido conectada exitosamente.</p>
          <p>Ahora puedes crear rifas y recibir pagos directamente en tu cuenta bancaria.</p>
          <div style="margin: 30px 0;">
            <a href="${this.configService.get('FRONTEND_URL') || 'http://localhost:3000'}/dashboard/create"
               style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Crear mi primera rifa
            </a>
          </div>
        </div>
      `,
    });
  }

  // ==================== Price Alert Notifications ====================

  async sendPriceDropAlert(
    email: string,
    data: { raffleName: string; oldPrice: number; newPrice: number; dropPercent: number; raffleUrl: string },
  ) {
    return this.sendEmail({
      to: email,
      subject: `📉 ¡Precio reducido! ${data.raffleName} ahora $${data.newPrice}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 30px; background: linear-gradient(135deg, #10B981, #059669); border-radius: 12px;">
            <h1 style="color: white; margin: 0;">📉 ¡El precio bajó ${data.dropPercent}%!</h1>
          </div>
          <div style="padding: 20px;">
            <p>Una rifa que guardaste en favoritos tiene nuevo precio:</p>
            <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="margin: 0 0 15px 0; color: #1F2937;">${data.raffleName}</h2>
              <p style="margin: 5px 0; text-decoration: line-through; color: #9CA3AF; font-size: 16px;">
                Antes: $${data.oldPrice.toFixed(2)}
              </p>
              <p style="margin: 5px 0; font-size: 28px; color: #10B981; font-weight: bold;">
                Ahora: $${data.newPrice.toFixed(2)}
              </p>
              <p style="margin: 10px 0 0 0; color: #059669; font-weight: 500;">
                ¡Ahorrás $${(data.oldPrice - data.newPrice).toFixed(2)} por ticket!
              </p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.raffleUrl}"
                 style="display: inline-block; background: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500;">
                Ver Rifa
              </a>
            </div>
            <p style="color: #6B7280; font-size: 12px; text-align: center;">
              Recibiste este email porque tenés esta rifa en tus favoritos.
            </p>
          </div>
        </div>
      `,
    });
  }

  // ==================== Referral Notifications ====================

  async sendReferralRewardNotification(
    email: string,
    data: { refereeName: string; amount: number; totalBalance: number },
  ) {
    return this.sendEmail({
      to: email,
      subject: `💰 ¡Ganaste $${data.amount.toFixed(2)} por referido!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 30px; background: linear-gradient(135deg, #F59E0B, #D97706); border-radius: 12px;">
            <h1 style="color: white; margin: 0;">💰 ¡Ganaste crédito!</h1>
          </div>
          <div style="padding: 20px;">
            <p>¡Buenas noticias! Tu referido hizo su primera compra.</p>
            <div style="background: #FEF3C7; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #92400E;">
                <strong>${data.refereeName}</strong> completó su primera compra
              </p>
              <p style="margin: 0; font-size: 32px; color: #D97706; font-weight: bold;">
                +$${data.amount.toFixed(2)}
              </p>
              <p style="margin: 10px 0 0 0; color: #78350F;">
                Balance total: $${data.totalBalance.toFixed(2)}
              </p>
            </div>
            <p>Seguí invitando amigos para ganar más crédito.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${this.configService.get('FRONTEND_URL') || 'http://localhost:3000'}/dashboard/referrals"
                 style="display: inline-block; background: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500;">
                Ver mis referidos
              </a>
            </div>
          </div>
        </div>
      `,
    });
  }

  async sendWelcomeWithReferralBonusEmail(
    email: string,
    data: { userName: string; referrerName: string },
  ) {
    return this.sendEmail({
      to: email,
      subject: '¡Bienvenido! Fuiste invitado por un amigo',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 30px; background: linear-gradient(135deg, #4F46E5, #7C3AED); border-radius: 12px;">
            <h1 style="color: white; margin: 0;">¡Bienvenido, ${data.userName}!</h1>
          </div>
          <div style="padding: 20px;">
            <p>Tu cuenta ha sido creada exitosamente.</p>
            <div style="background: #EDE9FE; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #5B21B6;">
                🎁 Fuiste invitado por <strong>${data.referrerName}</strong>
              </p>
            </div>
            <p>Ahora puedes:</p>
            <ul>
              <li>Participar en rifas y ganar premios increíbles</li>
              <li>Crear tus propias rifas (conecta tu cuenta de Mercado Pago)</li>
              <li>Invitar amigos y ganar crédito</li>
            </ul>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${this.configService.get('FRONTEND_URL') || 'http://localhost:3000'}"
                 style="display: inline-block; background: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500;">
                Explorar Rifas
              </a>
            </div>
          </div>
        </div>
      `,
    });
  }
}

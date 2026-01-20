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
    this.fromEmail =
      this.configService.get<string>('EMAIL_FROM') || 'onboarding@resend.dev';
    this.fromName =
      this.configService.get<string>('EMAIL_FROM_NAME') ||
      'Plataforma de Rifas';
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

        this.logger.log(
          `📧 Email sent: ${options.subject} -> ${options.to} (ID: ${data?.id})`,
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

  // ==================== Email Template Wrapper ====================

  private wrapEmailTemplate(content: string, options?: { showButton?: boolean; buttonText?: string; buttonUrl?: string }): string {
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    
    // Web Styles Palette
    const colors = {
      primary: '#0F766E', // Teal
      primaryDark: '#115E59',
      secondary: '#D97706', // Amber
      accent: '#F97316', // Orange
      background: '#FAFAF9', // Warm white
      card: '#FFFFFF',
      text: '#1F2937',
      muted: '#6B7280',
      border: '#E5E7EB',
      success: '#10B981',
      destructive: '#EF4444',
    };

    const buttonHtml = options?.showButton && options?.buttonText && options?.buttonUrl ? `
      <div style="text-align: center; margin: 32px 0;">
        <a href="${options.buttonUrl}" style="
          display: inline-block;
          background-color: ${colors.primary};
          color: white;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          font-size: 14px;
          box-shadow: 0 4px 6px -1px rgba(15, 118, 110, 0.2), 0 2px 4px -1px rgba(15, 118, 110, 0.1);
          transition: background-color 0.2s;
        ">${options.buttonText}</a>
      </div>
    ` : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;500;700&family=Fraunces:opsz,wght@9..144,300;400;600;700&display=swap" rel="stylesheet">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;500;700&family=Fraunces:opsz,wght@9..144,300;400;600;700&display=swap');
            body { font-family: 'DM Sans', sans-serif; }
            h1, h2, h3 { font-family: 'Fraunces', serif; }
          </style>
        </head>
        <body style="
          margin: 0;
          padding: 0;
          background-color: ${colors.background};
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          -webkit-font-smoothing: antialiased;
          color: ${colors.text};
        ">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${colors.background}; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: ${colors.card}; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05); border: 1px solid ${colors.border};">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark}); padding: 32px 40px; text-align: center;">
                      <h1 style="margin: 0; color: white; font-family: 'Fraunces', serif; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                        🎟️ Rifas
                      </h1>
                    </td>
                  </tr>
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      ${content}
                      ${buttonHtml}
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 40px; background-color: #F8F8F7; border-top: 1px solid ${colors.border};">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="text-align: center;">
                            <p style="margin: 0 0 12px 0; color: ${colors.muted}; font-size: 12px;">
                              <a href="${frontendUrl}" style="color: ${colors.primary}; text-decoration: none; font-weight: 500;">Ir a la plataforma</a>
                              &nbsp;•&nbsp;
                              <a href="${frontendUrl}/legal/terminos" style="color: ${colors.primary}; text-decoration: none; fontWeight: 500;">Términos</a>
                              &nbsp;•&nbsp;
                              <a href="${frontendUrl}/legal/privacidad" style="color: ${colors.primary}; text-decoration: none; fontWeight: 500;">Privacidad</a>
                            </p>
                            <p style="margin: 0; color: #9CA3AF; font-size: 11px;">
                              © ${new Date().getFullYear()} Rifas. Todos los derechos reservados.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }

  // ==================== Auth Notifications ====================


  async sendWelcomeEmail(email: string, data: { userName: string }) {
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    const content = `
      <h2 style="color: #1F2937; font-family: 'Fraunces', serif; font-size: 24px; font-weight: 700; margin: 0 0 16px 0;">
        ¡Bienvenido, ${data.userName}! 🎉
      </h2>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Tu cuenta ha sido creada exitosamente. Ya podés empezar a participar en rifas increíbles.
      </p>
      <div style="background: #F0FDFA; border: 1px solid #99F6E4; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="color: #0F766E; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">Ahora podés:</p>
        <ul style="color: #0F766E; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.8;">
          <li>Participar en rifas y ganar premios increíbles</li>
          <li>Crear tus propias rifas (conectá Mercado Pago)</li>
          <li>Gestionar tus tickets y seguir tus premios</li>
        </ul>
      </div>
      <p style="color: #9CA3AF; font-size: 12px; margin: 24px 0 0 0;">
        Si no creaste esta cuenta, podés ignorar este mensaje.
      </p>
    `;
    return this.sendEmail({
      to: email,
      subject: '¡Bienvenido a la Plataforma de Rifas!',
      html: this.wrapEmailTemplate(content, {
        showButton: true,
        buttonText: 'Explorar Rifas',
        buttonUrl: frontendUrl,
      }),
    });
  }


  async sendEmailVerificationCode(
    email: string,
    data: { userName: string; code: string; expiresInMinutes: number },
  ) {
    const content = `
      <h2 style="color: #1F2937; font-family: 'Fraunces', serif; font-size: 24px; font-weight: 700; margin: 0 0 16px 0;">
        ¡Hola ${data.userName}!
      </h2>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
        Para completar tu registro, ingresá este código:
      </p>
      <div style="background: linear-gradient(135deg, #F0FDFA, #E0F2FE); padding: 32px; text-align: center; border-radius: 12px; margin: 24px 0;">
        <div style="font-size: 42px; font-weight: 700; letter-spacing: 12px; color: #0F766E; font-family: monospace;">
          ${data.code}
        </div>
      </div>
      <p style="color: #6B7280; font-size: 14px; margin: 0;">
        Este código expira en <strong style="color: #1F2937;">${data.expiresInMinutes} minutos</strong>.
      </p>
      <p style="color: #9CA3AF; font-size: 12px; margin: 24px 0 0 0;">
        Si no solicitaste este código, podés ignorar este email.
      </p>
    `;
    return this.sendEmail({
      to: email,
      subject: 'Verificá tu email - Código de confirmación',
      html: this.wrapEmailTemplate(content),
    });
  }

  // ==================== Raffle Notifications ====================

  async sendTicketPurchaseConfirmation(
    email: string,
    data: { raffleName: string; ticketNumbers: number[]; amount: number },
  ) {
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    const content = `
      <h2 style="color: #10B981; font-family: 'Fraunces', serif; font-size: 24px; font-weight: 700; margin: 0 0 16px 0;">
        ¡Compra confirmada! ✅
      </h2>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
        Has comprado ${data.ticketNumbers.length} ticket(s) para la rifa:
      </p>
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <h3 style="color: #1F2937; font-family: 'Fraunces', serif; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">${data.raffleName}</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
          <p style="color: #4B5563; font-size: 14px; margin: 0;"><strong>Números:</strong> ${data.ticketNumbers.join(', ')}</p>
        </div>
        <div style="background: #ECFDF5; border-radius: 8px; padding: 12px; text-align: center;">
          <p style="color: #059669; font-size: 20px; font-weight: 700; margin: 0;">Total: $${data.amount.toFixed(2)}</p>
        </div>
      </div>
      <p style="color: #4B5563; font-size: 16px; text-align: center; margin: 0;">
        ¡Buena suerte! 🍀
      </p>
    `;
    return this.sendEmail({
      to: email,
      subject: `✅ Confirmación de compra - ${data.raffleName}`,
      html: this.wrapEmailTemplate(content, {
        showButton: true,
        buttonText: 'Ver mis tickets',
        buttonUrl: `${frontendUrl}/dashboard/tickets`,
      }),
    });
  }

  async sendRaffleCompletedNotification(
    email: string,
    data: { raffleName: string },
  ) {
    const content = `
      <h2 style="color: #0F766E; font-family: 'Fraunces', serif; font-size: 24px; font-weight: 700; margin: 0 0 16px 0;">
        ¡Todos los tickets vendidos! 🎯
      </h2>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        La rifa "<strong>${data.raffleName}</strong>" ha vendido todos sus tickets.
      </p>
      <div style="background: #F0FDFA; border-radius: 12px; padding: 20px; border: 1px solid #99F6E4;">
        <p style="color: #0F766E; font-size: 15px; margin: 0;">
          El sorteo se realizará pronto. ¡Mucha suerte!
        </p>
      </div>
    `;
    return this.sendEmail({
      to: email,
      subject: `🎯 Rifa completada - ${data.raffleName}`,
      html: this.wrapEmailTemplate(content),
    });
  }

  async sendWinnerNotification(
    email: string,
    data: { raffleName: string; productName: string; sellerEmail: string },
  ) {
    const content = `
      <div style="background: linear-gradient(135deg, #0F766E, #115E59); border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 24px;">
        <h2 style="color: white; font-family: 'Fraunces', serif; font-size: 28px; font-weight: 800; margin: 0;">🎉 ¡FELICITACIONES!</h2>
        <p style="color: rgba(255,255,255,0.9); font-size: 18px; margin: 8px 0 0 0;">¡Sos el ganador!</p>
      </div>
      <p style="color: #4B5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Has ganado la rifa <strong>"${data.raffleName}"</strong>.
      </p>
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <p style="margin: 0 0 12px 0; color: #4B5563;"><strong>Producto:</strong> ${data.productName}</p>
        <p style="margin: 0; color: #4B5563;"><strong>Email del vendedor:</strong> <a href="mailto:${data.sellerEmail}" style="color: #0F766E; text-decoration: none; font-weight: 600;">${data.sellerEmail}</a></p>
      </div>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6;">
        El vendedor se pondrá en contacto contigo pronto para coordinar el envío.
      </p>
      <div style="background: #FFFBEB; border: 1px solid #FEF3C7; border-radius: 8px; padding: 16px; margin-top: 24px;">
        <p style="color: #92400E; font-size: 14px; margin: 0;">
          <strong>Importante:</strong> Recordá confirmar la recepción del producto una vez que lo tengas para liberar el pago.
        </p>
      </div>
    `;
    return this.sendEmail({
      to: email,
      subject: `🎉 ¡GANASTE! - ${data.raffleName}`,
      html: this.wrapEmailTemplate(content),
    });
  }

  async sendRaffleParticipantNotification(
    email: string,
    data: { raffleName: string; winnerName: string },
  ) {
    const content = `
      <h2 style="color: #1F2937; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">Resultado del sorteo</h2>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        La rifa "<strong>${data.raffleName}</strong>" ya tiene un ganador.
      </p>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Lamentablemente no fuiste el ganador esta vez, ¡pero hay muchas otras rifas activas en las que podés participar!
      </p>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0;">
        ¡Gracias por participar y suerte la próxima! 🍀
      </p>
    `;
    return this.sendEmail({
      to: email,
      subject: `Resultado del sorteo - ${data.raffleName}`,
      html: this.wrapEmailTemplate(content),
    });
  }

  async sendRefundNotification(
    email: string,
    data: { raffleName: string; amount: number; reason: string },
  ) {
    const content = `
      <h2 style="color: #D94F4F; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">Reembolso procesado 💰</h2>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Se ha procesado exitosamente el reembolso para la rifa "<strong>${data.raffleName}</strong>".
      </p>
      <div style="background: #FEF2F2; border: 1px solid #FEE2E2; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <p style="margin: 0 0 12px 0; color: #4B5563; font-size: 18px;"><strong>Monto:</strong> <span style="color: #B91C1C; font-weight: 700;">$${data.amount.toFixed(2)}</span></p>
        <p style="margin: 0; color: #4B5563; font-size: 14px;"><strong>Motivo:</strong> ${data.reason}</p>
      </div>
      <p style="color: #6B7280; font-size: 14px; line-height: 1.6;">
        El dinero estará disponible en tu medio de pago original en los próximos días hábiles, dependiendo de tu entidad financiera.
      </p>
    `;
    return this.sendEmail({
      to: email,
      subject: `💰 Reembolso procesado - ${data.raffleName}`,
      html: this.wrapEmailTemplate(content),
    });
  }

  async sendSellerPaymentNotification(
    email: string,
    data: { raffleName: string; amount: number; fees: number },
  ) {
    const content = `
      <h2 style="color: #10B981; font-family: 'Fraunces', serif; font-size: 24px; font-weight: 700; margin: 0 0 16px 0;">¡Pago recibido! 💰</h2>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Has recibido el pago por tu rifa "<strong>${data.raffleName}</strong>".
      </p>
      <div style="background: #F0FDFA; border: 1px solid #99F6E4; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="color: #64748B; font-size: 14px; padding-bottom: 8px;">Monto bruto:</td>
            <td align="right" style="color: #1E293B; font-size: 14px; padding-bottom: 8px;">$${(data.amount + data.fees).toFixed(2)}</td>
          </tr>
          <tr>
            <td style="color: #64748B; font-size: 14px; padding-bottom: 8px;">Comisiones:</td>
            <td align="right" style="color: #EF4444; font-size: 14px; padding-bottom: 8px;">-$${data.fees.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="color: #1E293B; font-size: 18px; font-weight: 700; border-top: 1px solid #E2E8F0; padding-top: 12px;">Monto neto:</td>
            <td align="right" style="color: #059669; font-size: 22px; font-weight: 800; border-top: 1px solid #E2E8F0; padding-top: 12px;">$${data.amount.toFixed(2)}</td>
          </tr>
        </table>
      </div>
      <p style="color: #6B7280; font-size: 14px; line-height: 1.6;">
        El monto neto ha sido acreditado en tu cuenta vinculada.
      </p>
    `;
    return this.sendEmail({
      to: email,
      subject: `💰 Pago recibido - ${data.raffleName}`,
      html: this.wrapEmailTemplate(content),
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
    const relaunchUrl = `${this.configService.get('FRONTEND_URL') || 'http://localhost:3000'}/dashboard/sales?action=relaunch&raffleId=${data.raffleId}&priceReductionId=${data.priceReductionId}`;
    const percentDiscount = (
      ((data.currentPrice - data.suggestedPrice) / data.currentPrice) *
      100
    ).toFixed(0);

    const content = `
      <h2 style="color: #1F2937; font-family: 'Fraunces', serif; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">Sugerencia de relanzamiento 📉</h2>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Tu rifa "<strong>${data.raffleName}</strong>" no alcanzó el mínimo de ventas (${(data.percentageSold * 100).toFixed(0)}%). Todos los compradores fueron reembolsados.
      </p>
      <div style="background: #FFFBEB; border: 1px solid #FEF3C7; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="color: #D97706; font-size: 14px; padding-bottom: 8px;">Tickets vendidos:</td>
            <td align="right" style="color: #D97706; font-size: 14px; font-weight: 600; padding-bottom: 8px;">${(data.percentageSold * 100).toFixed(1)}%</td>
          </tr>
          <tr>
            <td style="color: #D97706; font-size: 14px; padding-bottom: 8px;">Precio anterior:</td>
            <td align="right" style="color: #D97706; font-size: 14px; text-decoration: line-through; padding-bottom: 8px;">$${data.currentPrice.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="color: #D97706; font-size: 18px; font-weight: 700; border-top: 1px solid #FDE68A; padding-top: 12px;">Precio sugerido:</td>
            <td align="right" style="color: #10B981; font-size: 22px; font-weight: 800; border-top: 1 solid #FDE68A; padding-top: 12px;">$${data.suggestedPrice.toFixed(2)}</td>
          </tr>
        </table>
        <div style="background: #10B981; color: white; display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-top: 16px;">
          ${percentDiscount}% DE DESCUENTO
        </div>
      </div>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Basándonos en el rendimiento, te sugerimos relanzarla con este precio ajustado para asegurar el éxito.
      </p>
    `;

    return this.sendEmail({
      to: email,
      subject: `📉 Sugerencia de precio - ${data.raffleName}`,
      html: this.wrapEmailTemplate(content, {
        showButton: true,
        buttonText: '🚀 Relanzar con precio sugerido',
        buttonUrl: relaunchUrl,
      }),
    });
  }

  async sendRaffleCancelledNotification(
    email: string,
    data: { raffleName: string; reason: string },
  ) {
    const content = `
      <h2 style="color: #EF4444; font-family: 'Fraunces', serif; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">Rifa cancelada ❌</h2>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        La rifa "<strong>${data.raffleName}</strong>" ha sido cancelada.
      </p>
      <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="color: #B91C1C; font-size: 14px; margin: 0;">
          <strong>Motivo:</strong> ${data.reason}
        </p>
      </div>
      <p style="color: #4B5563; font-size: 14px; line-height: 1.6;">
        Si realizaste una compra, el reembolso se procesará automáticamente y lo verás reflejado en tu cuenta en los próximos días.
      </p>
    `;
    return this.sendEmail({
      to: email,
      subject: `❌ Rifa cancelada - ${data.raffleName}`,
      html: this.wrapEmailTemplate(content),
    });
  }

  // ==================== Delivery Notifications ====================

  async sendSellerMustContactWinner(
    email: string,
    data: { raffleName: string; winnerEmail: string },
  ) {
    const content = `
      <h2 style="color: #0F766E; font-family: 'Fraunces', serif; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">¡Acción requerida! 🚀</h2>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Tu rifa "<strong>${data.raffleName}</strong>" tiene un ganador.
      </p>
      <div style="background: #F0FDFA; border: 1px solid #99F6E4; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <p style="color: #0F766E; font-size: 14px; margin: 0 0 12px 0;"><strong>Email del ganador:</strong></p>
        <p style="color: #1E293B; font-size: 18px; font-weight: 700; margin: 0;">${data.winnerEmail}</p>
      </div>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6;">
        Tenés <strong>48 horas</strong> para contactar al ganador y coordinar el envío del producto. Una vez despachado, no olvides marcarlo como enviado en la plataforma.
      </p>
    `;
    return this.sendEmail({
      to: email,
      subject: `🚀 ¡Acción requerida! Contacta al ganador - ${data.raffleName}`,
      html: this.wrapEmailTemplate(content),
    });
  }

  async sendDeliveryReminderToWinner(
    email: string,
    data: { raffleName: string; daysSinceShipped: number },
  ) {
    const content = `
      <h2 style="color: #1F2937; font-family: 'Fraunces', serif; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">¿Recibiste tu producto? 📦</h2>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Han pasado <strong>${data.daysSinceShipped} días</strong> desde que se envió tu producto de la rifa "<strong>${data.raffleName}</strong>".
      </p>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Por favor, recordá confirmar la recepción en la plataforma para que el vendedor pueda recibir su pago.
      </p>
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin: 24px 0;">
        <p style="color: #64748B; font-size: 14px; margin: 0;">
          Si tenés algún problema con el producto, podés abrir una disputa desde el panel de tus tickets.
        </p>
      </div>
    `;
    return this.sendEmail({
      to: email,
      subject: `📦 ¿Recibiste tu producto? - ${data.raffleName}`,
      html: this.wrapEmailTemplate(content, {
        showButton: true,
        buttonText: 'Confirmar recepción',
        buttonUrl: `${this.configService.get('FRONTEND_URL') || 'http://localhost:3000'}/dashboard/tickets`,
      }),
    });
  }

  async sendPaymentWillBeReleasedNotification(
    email: string,
    data: { raffleName: string; daysRemaining: number },
  ) {
    const content = `
      <h2 style="color: #1F2937; font-family: 'Fraunces', serif; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">El pago se liberará pronto ⏰</h2>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Te informamos que el pago por la rifa "<strong>${data.raffleName}</strong>" se liberará automáticamente en <strong>${data.daysRemaining} días</strong>.
      </p>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6;">
        Si ya recibiste el producto y está todo en orden, podés confirmarlo ahora mismo. Si hay algún problema, asegurate de abrir una disputa antes de que el pago se libere.
      </p>
    `;
    return this.sendEmail({
      to: email,
      subject: `⏰ Pago próximo a liberarse - ${data.raffleName}`,
      html: this.wrapEmailTemplate(content),
    });
  }

  // ==================== Dispute Notifications ====================

  async sendDisputeOpenedToSeller(
    email: string,
    data: { raffleName: string; disputeType: string; disputeTitle: string },
  ) {
    const content = `
      <h2 style="color: #EF4444; font-family: 'Fraunces', serif; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">Se ha abierto una disputa ⚠️</h2>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
        El ganador ha abierto una disputa por tu rifa "<strong>${data.raffleName}</strong>". El pago quedará retenido hasta que se resuelva la situación.
      </p>
      <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <p style="margin: 0 0 12px 0; color: #4B5563; font-size: 14px;"><strong>Tipo de disputa:</strong> ${data.disputeType}</p>
        <p style="margin: 0; color: #1E293B; font-size: 16px; font-weight: 600;">"${data.disputeTitle}"</p>
      </div>
      <div style="background: #FFFBEB; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="color: #D97706; font-size: 14px; margin: 0; font-weight: 600;">
          Tenés 48 horas para responder a esta disputa desde tu panel de ventas.
        </p>
      </div>
    `;
    return this.sendEmail({
      to: email,
      subject: `⚠️ Disputa abierta - ${data.raffleName}`,
      html: this.wrapEmailTemplate(content),
    });
  }

  async sendDisputeOpenedToBuyer(
    email: string,
    data: { raffleName: string; disputeId: string },
  ) {
    const content = `
      <h2 style="color: #1F2937; font-family: 'Fraunces', serif; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">Disputa registrada 📝</h2>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Hemos recibido tu disputa por la rifa "<strong>${data.raffleName}</strong>".
      </p>
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
        <p style="color: #64748B; font-size: 12px; margin: 0 0 8px 0;">ID DE DISPUTA</p>
        <p style="color: #1E293B; font-size: 20px; font-weight: 700; margin: 0; font-family: monospace;">${data.disputeId}</p>
      </div>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6;">
        El vendedor tiene 48 horas para responder. Te mantendremos informado sobre cualquier novedad en el proceso.
      </p>
    `;
    return this.sendEmail({
      to: email,
      subject: `📝 Disputa registrada - ${data.raffleName}`,
      html: this.wrapEmailTemplate(content),
    });
  }

  async sendSellerMustRespondDispute(
    email: string,
    data: { raffleName: string; hoursRemaining: number },
  ) {
    const content = `
      <h2 style="color: #EF4444; font-family: 'Fraunces', serif; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">Responde a la disputa ⚠️</h2>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
        Te recordamos que tenés una disputa abierta para la rifa "<strong>${data.raffleName}</strong>".
      </p>
      <div style="background: #FFFBEB; border: 1px solid #FEF3C7; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
        <p style="color: #D97706; font-size: 14px; margin: 0 0 8px 0;">TIEMPO RESTANTE</p>
        <p style="color: #B45309; font-size: 32px; font-weight: 800; margin: 0;">${data.hoursRemaining} horas</p>
      </div>
      <p style="color: #EF4444; font-size: 14px; font-weight: 600; line-height: 1.6;">
        Si no respondes dentro del plazo, la disputa podría resolverse automáticamente a favor del comprador y se realizará el reembolso.
      </p>
    `;
    return this.sendEmail({
      to: email,
      subject: `⚠️ URGENTE: Responde la disputa - ${data.raffleName}`,
      html: this.wrapEmailTemplate(content),
    });
  }

  async sendDisputeResolvedNotification(
    email: string,
    data: { raffleName: string; resolution: string; refundAmount?: number },
  ) {
    const content = `
      <h2 style="color: #0F766E; font-family: 'Fraunces', serif; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">Disputa resuelta ✅</h2>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        La disputa por la rifa "<strong>${data.raffleName}</strong>" ha sido resuelta por nuestro equipo de soporte.
      </p>
      <div style="background: #F0FDFA; border: 1px solid #99F6E4; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <p style="color: #0F766E; font-size: 14px; margin: 0 0 8px 0;"><strong>Resolución:</strong></p>
        <p style="color: #1E293B; font-size: 16px; margin: 0 0 ${data.refundAmount ? '16px' : '0'} 0;">${data.resolution}</p>
        ${data.refundAmount ? `
          <p style="color: #0F766E; font-size: 14px; margin: 0 0 8px 0;"><strong>Reembolso:</strong></p>
          <p style="color: #B91C1C; font-size: 20px; font-weight: 700; margin: 0;">$${data.refundAmount.toFixed(2)}</p>
        ` : ''}
      </div>
    `;
    return this.sendEmail({
      to: email,
      subject: `✅ Disputa resuelta - ${data.raffleName}`,
      html: this.wrapEmailTemplate(content),
    });
  }

  async sendRefundDueToDisputeNotification(
    email: string,
    data: { raffleName: string; amount: number },
  ) {
    const content = `
      <h2 style="color: #EF4444; font-family: 'Fraunces', serif; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">Reembolso procesado 💰</h2>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Se ha procesado un reembolso de <strong>$${data.amount.toFixed(2)}</strong> para la rifa "<strong>${data.raffleName}</strong>" debido a la resolución de la disputa.
      </p>
      <p style="color: #6B7280; font-size: 14px; line-height: 1.6;">
        El dinero se verá reflejado en tu cuenta en los próximos días hábiles.
      </p>
    `;
    return this.sendEmail({
      to: email,
      subject: `💰 Reembolso por disputa - ${data.raffleName}`,
      html: this.wrapEmailTemplate(content),
    });
  }

  // ==================== Stripe Connect Notifications ====================

  async sendStripeConnectSuccessNotification(
    email: string,
    data: { userName: string },
  ) {
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    const content = `
      <h2 style="color: #0F766E; font-family: 'Fraunces', serif; font-size: 24px; font-weight: 700; margin: 0 0 16px 0;">¡Cuenta conectada! ✅</h2>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Hola ${data.userName}, tu cuenta ha sido conectada exitosamente.
      </p>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6;">
        Ya estás listo para crear rifas y recibir los pagos directamente en tu cuenta. ¡Empezá a vender hoy mismo!
      </p>
    `;
    return this.sendEmail({
      to: email,
      subject: '✅ ¡Cuenta conectada!',
      html: this.wrapEmailTemplate(content, {
        showButton: true,
        buttonText: 'Crear mi primera rifa',
        buttonUrl: `${frontendUrl}/dashboard/create`,
      }),
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
    const content = `
      <div style="background: linear-gradient(135deg, #10B981, #059669); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <h2 style="color: white; font-family: 'Fraunces', serif; font-size: 24px; font-weight: 800; margin: 0;">📉 ¡EL PRECIO BAJÓ ${data.dropPercent}%!</h2>
      </div>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Una rifa que tenés en favoritos tiene un nuevo precio:
      </p>
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <h3 style="color: #1F2937; font-family: 'Fraunces', serif; font-size: 18px; font-weight: 700; margin: 0 0 16px 0;">${data.raffleName}</h3>
        <p style="color: #94A3B8; font-size: 16px; text-decoration: line-through; margin: 0 0 4px 0;">Antes: $${data.oldPrice.toFixed(2)}</p>
        <p style="color: #059669; font-size: 32px; font-weight: 800; margin: 0;">Ahora: $${data.newPrice.toFixed(2)}</p>
        <p style="color: #10B981; font-size: 14px; font-weight: 600; margin: 12px 0 0 0;">¡Ahorrás $${(data.oldPrice - data.newPrice).toFixed(2)} por ticket!</p>
      </div>
      <p style="color: #6B7280; font-size: 12px; text-align: center; margin-top: 24px;">
        Recibiste este email porque agregaste esta rifa a tus favoritos.
      </p>
    `;
    return this.sendEmail({
      to: email,
      subject: `📉 ¡Precio reducido! ${data.raffleName} ahora $${data.newPrice}`,
      html: this.wrapEmailTemplate(content, {
        showButton: true,
        buttonText: 'Ver Rifa',
        buttonUrl: data.raffleUrl,
      }),
    });
  }

  // ==================== Referral Notifications ====================

  async sendReferralRewardNotification(
    email: string,
    data: { refereeName: string; amount: number; totalBalance: number },
  ) {
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    const content = `
      <div style="background: linear-gradient(135deg, #F59E0B, #D97706); border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 24px;">
        <h2 style="color: white; font-family: 'Fraunces', serif; font-size: 24px; font-weight: 800; margin: 0;">💰 ¡GANASTE CRÉDITO!</h2>
      </div>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        ¡Buenas noticias! Tu referido <strong>${data.refereeName}</strong> hizo su primera compra y ganaste una recompensa.
      </p>
      <div style="background: #FFFBEB; border: 1px solid #FEF3C7; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
        <p style="color: #D97706; font-size: 42px; font-weight: 800; margin: 0;">+$${data.amount.toFixed(2)}</p>
        <p style="color: #92400E; font-size: 14px; margin: 8px 0 0 0; font-weight: 600;">Balance total: $${data.totalBalance.toFixed(2)}</p>
      </div>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6;">
        Seguí invitando amigos para seguir sumando crédito en la plataforma.
      </p>
    `;
    return this.sendEmail({
      to: email,
      subject: `💰 ¡Ganaste $${data.amount.toFixed(2)} por referido!`,
      html: this.wrapEmailTemplate(content, {
        showButton: true,
        buttonText: 'Ver mis referidos',
        buttonUrl: `${frontendUrl}/dashboard/referrals`,
      }),
    });
  }

  async sendWelcomeWithReferralBonusEmail(
    email: string,
    data: { userName: string; referrerName: string },
  ) {
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    const content = `
      <h2 style="color: #1F2937; font-family: 'Fraunces', serif; font-size: 24px; font-weight: 700; margin: 0 0 16px 0;">¡Bienvenido, ${data.userName}! 🎉</h2>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Tu cuenta ha sido creada exitosamente.
      </p>
      <div style="background: #F0FDFA; border: 1px solid #99F6E4; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="color: #0F766E; font-size: 15px; margin: 0;">
          🎁 Fuiste invitado por <strong>${data.referrerName}</strong>
        </p>
      </div>
      <div style="background: #F0FDFA; border: 1px solid #99F6E4; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="color: #0F766E; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">Ahora podés:</p>
        <ul style="color: #0F766E; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.8;">
          <li>Participar en rifas y ganar premios</li>
          <li>Crear tus propias rifas</li>
          <li>Invitar amigos y ganar crédito</li>
        </ul>
      </div>
    `;
    return this.sendEmail({
      to: email,
      subject: '¡Bienvenido! Fuiste invitado por un amigo',
      html: this.wrapEmailTemplate(content, {
        showButton: true,
        buttonText: 'Explorar Rifas',
        buttonUrl: frontendUrl,
      }),
    });
  }
}

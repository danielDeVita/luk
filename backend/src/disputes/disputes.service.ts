import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { OpenDisputeInput, RespondDisputeInput, ResolveDisputeInput } from './dto/dispute.input';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import {
  RaffleEvents,
  DisputeOpenedEvent,
  DisputeResolvedEvent,
} from '../common/events';

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    private prisma: PrismaService,
    private paymentsService: PaymentsService,
    private notifications: NotificationsService,
    private audit: AuditService,
    private eventEmitter: EventEmitter2,
  ) {}

  async openDispute(userId: string, input: OpenDisputeInput) {
    const raffle = await this.prisma.raffle.findUnique({
      where: { id: input.raffleId },
      include: { dispute: true },
    });

    if (!raffle) {
      throw new NotFoundException('Rifa no encontrada');
    }

    if (raffle.winnerId !== userId) {
      throw new ForbiddenException('Solo el ganador puede abrir una disputa');
    }

    if (raffle.dispute) {
      throw new BadRequestException('Ya existe una disputa para esta rifa');
    }

    if (raffle.estado !== 'SORTEADA') {
      throw new BadRequestException('Solo se pueden disputar rifas sorteadas');
    }

    await this.prisma.raffle.update({
      where: { id: input.raffleId },
      data: { deliveryStatus: 'DISPUTED' },
    });

    const dispute = await this.prisma.dispute.create({
      data: {
        raffleId: input.raffleId,
        reporterId: userId,
        tipo: input.tipo,
        titulo: input.titulo,
        descripcion: input.descripcion,
        evidencias: input.evidencias || [],
        estado: 'ABIERTA',
        evidenciasVendedor: [],
      },
      include: { raffle: { include: { seller: true } }, reporter: true },
    });

    // Update buyer's dispute count in reputation
    await this.updateBuyerDisputeCount(userId);

    // Emit dispute opened event for cross-cutting concerns
    this.eventEmitter.emit(
      RaffleEvents.DISPUTE_OPENED,
      new DisputeOpenedEvent(dispute.id, input.raffleId, userId, dispute.raffle.sellerId, input.tipo),
    );

    // Notify seller
    await this.notifications.sendDisputeOpenedToSeller(
      dispute.raffle.seller.email,
      {
        raffleName: dispute.raffle.titulo,
        disputeType: input.tipo,
        disputeTitle: input.titulo,
      },
    );

    await this.notifications.create(
      dispute.raffle.sellerId,
      'SYSTEM',
      'Disputa abierta',
      `Se ha abierto una disputa por "${dispute.raffle.titulo}". Tienes 48hs para responder.`,
    );

    // Notify buyer that dispute was registered
    await this.notifications.sendDisputeOpenedToBuyer(
      dispute.reporter.email,
      {
        raffleName: dispute.raffle.titulo,
        disputeId: dispute.id,
      },
    );

    this.logger.log(`Dispute opened for raffle ${input.raffleId} by user ${userId}`);

    return dispute;
  }

  private async updateBuyerDisputeCount(userId: string) {
    await this.prisma.userReputation.upsert({
      where: { userId },
      create: {
        userId,
        disputasComoCompradorAbiertas: 1,
      },
      update: {
        disputasComoCompradorAbiertas: { increment: 1 },
      },
    });
  }

  async respondDispute(userId: string, disputeId: string, input: RespondDisputeInput) {
    const dispute = await this.findOne(disputeId);

    const raffle = await this.prisma.raffle.findUnique({
      where: { id: dispute.raffleId },
    });

    if (!raffle || raffle.sellerId !== userId) {
      throw new ForbiddenException('Solo el vendedor puede responder a la disputa');
    }

    if (dispute.estado !== 'ABIERTA' && dispute.estado !== 'ESPERANDO_RESPUESTA_VENDEDOR') {
      throw new BadRequestException('La disputa no está en un estado válido para responder');
    }

    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        respuestaVendedor: input.respuesta,
        evidenciasVendedor: input.evidencias || [],
        estado: 'EN_MEDIACION',
        fechaRespuestaVendedor: new Date(),
      },
      include: { raffle: true, reporter: true },
    });
  }

  async resolveDispute(adminId: string, disputeId: string, input: ResolveDisputeInput) {
    const dispute = await this.findOne(disputeId);

    const validStatuses = ['RESUELTA_COMPRADOR', 'RESUELTA_VENDEDOR', 'RESUELTA_PARCIAL'];
    if (!validStatuses.includes(input.decision)) {
      throw new BadRequestException('Estado de resolución inválido');
    }

    const updatedDispute = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        estado: input.decision,
        resolucion: input.resolucion,
        montoReembolsado: input.montoReembolsado,
        montoPagadoVendedor: input.montoPagadoVendedor,
        adminNotes: input.adminNotes,
        resolvedAt: new Date(),
      },
      include: { raffle: { include: { seller: true, winner: true, tickets: true } }, reporter: true },
    });

    // Process based on decision
    const sellerId = updatedDispute.raffle.sellerId;
    const buyerId = updatedDispute.reporterId;

    if (input.decision === 'RESUELTA_COMPRADOR') {
      // Buyer wins: update seller reputation negatively, process refund
      await this.updateSellerDisputeLost(sellerId);

      if (input.montoReembolsado && input.montoReembolsado > 0) {
        await this.processDisputeRefund(updatedDispute.raffle, Number(input.montoReembolsado));
      }
    } else if (input.decision === 'RESUELTA_VENDEDOR') {
      // Seller wins: update seller reputation positively
      await this.updateSellerDisputeWon(sellerId);
    } else if (input.decision === 'RESUELTA_PARCIAL') {
      // Partial resolution: both parties share the outcome
      if (input.montoReembolsado && input.montoReembolsado > 0) {
        await this.processDisputeRefund(updatedDispute.raffle, Number(input.montoReembolsado));
      }
    }

    // Update raffle delivery status based on resolution
    await this.prisma.raffle.update({
      where: { id: updatedDispute.raffleId },
      data: {
        deliveryStatus: input.decision === 'RESUELTA_VENDEDOR' ? 'CONFIRMED' : 'DISPUTED',
        estado: 'FINALIZADA',
      },
    });

    // Send notifications to both parties
    await this.notifications.sendDisputeResolvedNotification(
      updatedDispute.reporter.email,
      {
        raffleName: updatedDispute.raffle.titulo,
        resolution: input.resolucion,
        refundAmount: input.montoReembolsado ? Number(input.montoReembolsado) : undefined,
      },
    );

    await this.notifications.sendDisputeResolvedNotification(
      updatedDispute.raffle.seller.email,
      {
        raffleName: updatedDispute.raffle.titulo,
        resolution: input.resolucion,
      },
    );

    // In-app notifications
    await this.notifications.create(
      buyerId,
      'INFO',
      'Disputa resuelta',
      `La disputa por "${updatedDispute.raffle.titulo}" ha sido resuelta.`,
    );

    await this.notifications.create(
      sellerId,
      'INFO',
      'Disputa resuelta',
      `La disputa por "${updatedDispute.raffle.titulo}" ha sido resuelta.`,
    );

    // Audit log
    await this.audit.logDisputeResolved(adminId, disputeId, input.resolucion, {
      decision: input.decision,
      montoReembolsado: input.montoReembolsado,
      montoPagadoVendedor: input.montoPagadoVendedor,
    });

    // Emit dispute resolved event for cross-cutting concerns
    this.eventEmitter.emit(
      RaffleEvents.DISPUTE_RESOLVED,
      new DisputeResolvedEvent(
        disputeId,
        updatedDispute.raffleId,
        input.decision,
        Number(input.montoReembolsado || 0),
        Number(input.montoPagadoVendedor || 0),
      ),
    );

    this.logger.log(`Dispute ${disputeId} resolved with decision: ${input.decision}`);

    return updatedDispute;
  }

  private async updateSellerDisputeWon(sellerId: string) {
    await this.prisma.userReputation.upsert({
      where: { userId: sellerId },
      create: {
        userId: sellerId,
        disputasComoVendedorGanadas: 1,
      },
      update: {
        disputasComoVendedorGanadas: { increment: 1 },
      },
    });
  }

  private async updateSellerDisputeLost(sellerId: string) {
    await this.prisma.userReputation.upsert({
      where: { userId: sellerId },
      create: {
        userId: sellerId,
        disputasComoVendedorPerdidas: 1,
      },
      update: {
        disputasComoVendedorPerdidas: { increment: 1 },
      },
    });
  }

  private async processDisputeRefund(raffle: any, amount: number) {
    // Find tickets to refund
    const tickets = raffle.tickets?.filter((t: any) => t.estado === 'PAGADO' && t.mpPaymentId);

    if (!tickets || tickets.length === 0) {
      this.logger.warn(`No paid tickets found for raffle ${raffle.id} to refund`);
      return;
    }

    // Calculate proportional refund per ticket
    const refundPerTicket = amount / tickets.length;

    for (const ticket of tickets) {
      try {
        // Only refund if there's an MP payment
        if (ticket.mpPaymentId) {
          await this.paymentsService.refundPayment(ticket.mpPaymentId);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to refund ticket ${ticket.id}: ${message}`);
      }
    }

    // Notify buyer of refund
    if (raffle.winner) {
      await this.notifications.sendRefundDueToDisputeNotification(
        raffle.winner.email,
        {
          raffleName: raffle.titulo,
          amount,
        },
      );
    }
  }

  async findOne(id: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: { raffle: { include: { seller: true, winner: true } }, reporter: true },
    });

    if (!dispute) {
      throw new NotFoundException('Disputa no encontrada');
    }

    return dispute;
  }

  async findByUser(userId: string) {
    return this.prisma.dispute.findMany({
      where: {
        OR: [
          { reporterId: userId },
          { raffle: { sellerId: userId } },
        ],
      },
      include: { raffle: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllPending() {
    return this.prisma.dispute.findMany({
      where: {
        estado: { in: ['ABIERTA', 'ESPERANDO_RESPUESTA_VENDEDOR', 'EN_MEDIACION'] },
      },
      include: { raffle: { include: { seller: true, winner: true } }, reporter: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findAll(estado?: string, page = 1, limit = 10) {
    const where = estado ? { estado: estado as any } : {};

    const [disputes, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        include: { raffle: true, reporter: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return { disputes, total, page, limit };
  }
}

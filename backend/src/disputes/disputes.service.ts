import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, DisputeStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  OpenDisputeInput,
  RespondDisputeInput,
  ResolveDisputeInput,
} from './dto/dispute.input';
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
      new DisputeOpenedEvent(
        dispute.id,
        input.raffleId,
        userId,
        dispute.raffle.sellerId,
        input.tipo,
      ),
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
      '/dashboard/disputes',
    );

    // Notify buyer that dispute was registered
    await this.notifications.sendDisputeOpenedToBuyer(dispute.reporter.email, {
      raffleName: dispute.raffle.titulo,
      disputeId: dispute.id,
    });

    this.logger.log(
      `Dispute opened for raffle ${input.raffleId} by user ${userId}`,
    );

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

  async respondDispute(
    userId: string,
    disputeId: string,
    input: RespondDisputeInput,
  ) {
    const dispute = await this.findOne(disputeId);

    const raffle = await this.prisma.raffle.findUnique({
      where: { id: dispute.raffleId },
    });

    if (!raffle || raffle.sellerId !== userId) {
      throw new ForbiddenException(
        'Solo el vendedor puede responder a la disputa',
      );
    }

    if (
      dispute.estado !== 'ABIERTA' &&
      dispute.estado !== 'ESPERANDO_RESPUESTA_VENDEDOR'
    ) {
      throw new BadRequestException(
        'La disputa no está en un estado válido para responder',
      );
    }

    const updatedDispute = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        respuestaVendedor: input.respuesta,
        evidenciasVendedor: input.evidencias || [],
        estado: 'EN_MEDIACION',
        fechaRespuestaVendedor: new Date(),
      },
      include: { raffle: { include: { seller: true } }, reporter: true },
    });

    // Notify buyer that seller responded
    await this.notifications.create(
      updatedDispute.reporterId,
      'INFO',
      'El vendedor respondió a tu disputa',
      `El vendedor ha respondido a tu disputa por "${updatedDispute.raffle.titulo}".`,
      '/dashboard/disputes',
    );

    await this.notifications.sendDisputeSellerRespondedNotification(
      updatedDispute.reporter.email,
      { raffleName: updatedDispute.raffle.titulo },
    );

    return updatedDispute;
  }

  async resolveDispute(
    adminId: string,
    disputeId: string,
    input: ResolveDisputeInput,
  ) {
    return this.resolveDisputeInternal(disputeId, input, adminId);
  }

  async resolveDisputeBySystem(disputeId: string, input: ResolveDisputeInput) {
    return this.resolveDisputeInternal(disputeId, input);
  }

  private async resolveDisputeInternal(
    disputeId: string,
    input: ResolveDisputeInput,
    adminId?: string,
  ) {
    const dispute = await this.findOne(disputeId);

    if (
      !['ABIERTA', 'ESPERANDO_RESPUESTA_VENDEDOR', 'EN_MEDIACION'].includes(
        dispute.estado,
      )
    ) {
      throw new BadRequestException(
        'La disputa no está en un estado válido para resolver',
      );
    }

    const validStatuses = [
      'RESUELTA_COMPRADOR',
      'RESUELTA_VENDEDOR',
      'RESUELTA_PARCIAL',
    ];
    if (!validStatuses.includes(input.decision)) {
      throw new BadRequestException('Estado de resolución inválido');
    }

    const buyerTickets = await this.prisma.ticket.findMany({
      where: {
        raffleId: dispute.raffleId,
        buyerId: dispute.reporterId,
        estado: 'PAGADO',
      },
      select: { precioPagado: true },
    });

    const buyerPaidTotal = buyerTickets.reduce(
      (sum, t) => sum + Number(t.precioPagado),
      0,
    );

    let refundAmount = 0;
    let sellerAmount = 0;

    if (input.decision === 'RESUELTA_COMPRADOR') {
      refundAmount = Number(input.montoReembolsado ?? buyerPaidTotal);
      sellerAmount = 0;
    } else if (input.decision === 'RESUELTA_VENDEDOR') {
      refundAmount = 0;
      sellerAmount = Number(input.montoPagadoVendedor ?? buyerPaidTotal);
    } else {
      refundAmount = Number(input.montoReembolsado ?? 0);
      sellerAmount = Number(
        input.montoPagadoVendedor ?? Math.max(buyerPaidTotal - refundAmount, 0),
      );
    }

    if (refundAmount < 0 || sellerAmount < 0) {
      throw new BadRequestException('Los montos no pueden ser negativos');
    }

    if (input.decision !== 'RESUELTA_VENDEDOR' && refundAmount <= 0) {
      throw new BadRequestException(
        'Debes indicar un monto de reembolso mayor a 0',
      );
    }

    if (input.decision === 'RESUELTA_PARCIAL' && sellerAmount <= 0) {
      throw new BadRequestException(
        'La resolución parcial debe incluir un monto para el vendedor',
      );
    }

    if (refundAmount + sellerAmount > buyerPaidTotal + 0.01) {
      throw new BadRequestException(
        `El monto total (${(refundAmount + sellerAmount).toFixed(2)}) excede el total pagado por el comprador (${buyerPaidTotal.toFixed(2)})`,
      );
    }

    refundAmount = Math.round(refundAmount * 100) / 100;
    sellerAmount = Math.round(sellerAmount * 100) / 100;

    if (refundAmount > 0) {
      await this.processDisputeRefund(
        dispute.raffleId,
        dispute.reporterId,
        refundAmount,
        dispute.raffle.titulo,
        dispute.reporter.email,
      );
    }

    const updatedDispute = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        estado: input.decision,
        resolucion: input.resolucion,
        montoReembolsado: refundAmount,
        montoPagadoVendedor: sellerAmount,
        adminNotes: input.adminNotes,
        resolvedAt: new Date(),
      },
      include: {
        raffle: { include: { seller: true, winner: true } },
        reporter: true,
      },
    });

    // Process based on decision
    const sellerId = updatedDispute.raffle.sellerId;
    const buyerId = updatedDispute.reporterId;

    if (input.decision === 'RESUELTA_COMPRADOR') {
      // Buyer wins: update seller reputation negatively
      await this.updateSellerDisputeLost(sellerId);
    } else if (input.decision === 'RESUELTA_VENDEDOR') {
      // Seller wins: update seller reputation positively
      await this.updateSellerDisputeWon(sellerId);
    }

    // Update raffle delivery status based on resolution
    await this.prisma.raffle.update({
      where: { id: updatedDispute.raffleId },
      data: {
        deliveryStatus:
          input.decision === 'RESUELTA_VENDEDOR' ? 'CONFIRMED' : 'DISPUTED',
        estado: 'FINALIZADA',
      },
    });

    // Send notifications to both parties
    await this.notifications.sendDisputeResolvedNotification(
      updatedDispute.reporter.email,
      {
        raffleName: updatedDispute.raffle.titulo,
        resolution: input.resolucion,
        refundAmount: refundAmount > 0 ? refundAmount : undefined,
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
      '/dashboard/disputes',
    );

    await this.notifications.create(
      sellerId,
      'INFO',
      'Disputa resuelta',
      `La disputa por "${updatedDispute.raffle.titulo}" ha sido resuelta.`,
      '/dashboard/disputes',
    );

    if (adminId) {
      await this.audit.logDisputeResolved(
        adminId,
        disputeId,
        input.resolucion,
        {
          decision: input.decision,
          montoReembolsado: refundAmount,
          montoPagadoVendedor: sellerAmount,
        },
      );
    }

    // Emit dispute resolved event for cross-cutting concerns
    this.eventEmitter.emit(
      RaffleEvents.DISPUTE_RESOLVED,
      new DisputeResolvedEvent(
        disputeId,
        updatedDispute.raffleId,
        input.decision,
        refundAmount,
        sellerAmount,
      ),
    );

    this.logger.log(
      `Dispute ${disputeId} resolved with decision: ${input.decision}`,
    );

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

  private async processDisputeRefund(
    raffleId: string,
    buyerId: string,
    amount: number,
    raffleName: string,
    buyerEmail: string,
  ) {
    const tickets = await this.prisma.ticket.findMany({
      where: {
        raffleId,
        buyerId,
        estado: 'PAGADO',
        mpPaymentId: { not: null },
      },
      select: {
        id: true,
        mpPaymentId: true,
        precioPagado: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (tickets.length === 0) {
      throw new BadRequestException(
        'No hay pagos del comprador para procesar reembolso',
      );
    }

    const groupedByPayment = new Map<
      string,
      { totalAmount: number; ticketIds: string[] }
    >();
    for (const ticket of tickets) {
      if (!ticket.mpPaymentId) continue;
      const existing = groupedByPayment.get(ticket.mpPaymentId) ?? {
        totalAmount: 0,
        ticketIds: [],
      };
      existing.totalAmount += Number(ticket.precioPagado);
      existing.ticketIds.push(ticket.id);
      groupedByPayment.set(ticket.mpPaymentId, existing);
    }

    let remainingCents = Math.round(amount * 100);
    const fullyRefundedTicketIds: string[] = [];

    for (const [mpPaymentId, group] of groupedByPayment) {
      if (remainingCents <= 0) break;

      const groupCents = Math.round(group.totalAmount * 100);
      const refundCents = Math.min(remainingCents, groupCents);
      const refundAmount = refundCents / 100;
      const fullGroupRefund = refundCents >= groupCents;

      const success = await this.paymentsService.refundPayment(
        mpPaymentId,
        fullGroupRefund ? undefined : refundAmount,
      );

      if (!success) {
        throw new BadRequestException(
          `No se pudo procesar el reembolso para el pago ${mpPaymentId}`,
        );
      }

      if (fullGroupRefund) {
        fullyRefundedTicketIds.push(...group.ticketIds);
      }

      remainingCents -= refundCents;
    }

    if (remainingCents > 0) {
      throw new BadRequestException(
        'No fue posible completar el monto de reembolso solicitado',
      );
    }

    if (fullyRefundedTicketIds.length > 0) {
      await this.prisma.ticket.updateMany({
        where: {
          id: { in: fullyRefundedTicketIds },
          estado: 'PAGADO',
        },
        data: { estado: 'REEMBOLSADO' },
      });
    }

    await this.notifications.sendRefundDueToDisputeNotification(buyerEmail, {
      raffleName,
      amount,
    });
  }

  async findOne(id: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        raffle: { include: { seller: true, winner: true } },
        reporter: true,
      },
    });

    if (!dispute) {
      throw new NotFoundException('Disputa no encontrada');
    }

    return dispute;
  }

  async findOneForUser(id: string, userId: string, userRole: UserRole) {
    const dispute = await this.findOne(id);

    const isAdmin = userRole === UserRole.ADMIN;
    const isReporter = dispute.reporterId === userId;
    const isSeller = dispute.raffle.sellerId === userId;

    if (!isAdmin && !isReporter && !isSeller) {
      throw new ForbiddenException('No tienes permisos para ver esta disputa');
    }

    return dispute;
  }

  async findByUser(userId: string) {
    return this.prisma.dispute.findMany({
      where: {
        OR: [{ reporterId: userId }, { raffle: { sellerId: userId } }],
      },
      include: {
        raffle: { include: { product: true, seller: true, winner: true } },
        reporter: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllPending() {
    return this.prisma.dispute.findMany({
      where: {
        estado: {
          in: ['ABIERTA', 'ESPERANDO_RESPUESTA_VENDEDOR', 'EN_MEDIACION'],
        },
      },
      include: {
        raffle: { include: { seller: true, winner: true, product: true } },
        reporter: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findAll(estado?: string, page = 1, limit = 10) {
    const where: Prisma.DisputeWhereInput = estado
      ? { estado: estado as DisputeStatus }
      : {};

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

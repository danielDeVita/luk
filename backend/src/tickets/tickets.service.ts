import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { Prisma, RaffleStatus, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { RaffleEvents, TicketsRefundedEvent } from '../common/events';
import { SocialPromotionsService } from '../social-promotions/social-promotions.service';

/**
 * Type for raw SQL query result when selecting raffle with sold count.
 * Uses snake_case to match database column names.
 */
interface RaffleWithSoldCount {
  id: string;
  estado: RaffleStatus;
  is_hidden: boolean;
  seller_id: string;
  total_tickets: number;
  precio_por_ticket: Prisma.Decimal;
  titulo: string;
  sold_count: bigint;
}

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);
  private readonly MAX_TICKET_PERCENTAGE = 0.5; // 50%

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => PaymentsService))
    private paymentsService: PaymentsService,
    private socialPromotionsService: SocialPromotionsService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Buy tickets with pessimistic locking to prevent overselling.
   * Returns Mercado Pago checkout URL (init_point) for payment.
   */
  async buyTickets(
    userId: string,
    raffleId: string,
    cantidad: number,
    bonusGrantId?: string | null,
    promotionToken?: string | null,
  ) {
    // Check if buyer has at least one shipping address (for prize delivery)
    const buyerAddressCount = await this.prisma.shippingAddress.count({
      where: { userId },
    });

    if (buyerAddressCount === 0) {
      throw new BadRequestException(
        'Debes agregar una dirección de envío antes de comprar tickets. Si ganas, necesitamos saber dónde enviarte el premio.',
      );
    }

    await this.paymentsService.expireSupersededInitiatedMockPaymentsForRaffle(
      userId,
      raffleId,
    );

    return this.prisma.$transaction(
      async (tx) => {
        const reservationId = randomUUID();

        // Lock the raffle row for update to prevent concurrent modifications
        const [raffle] = await tx.$queryRaw<RaffleWithSoldCount[]>`
        SELECT r.*,
               (SELECT COUNT(*) FROM tickets t WHERE t.raffle_id = r.id) as sold_count
        FROM raffles r
        WHERE r.id = ${raffleId}
        FOR UPDATE
      `;

        if (!raffle) {
          throw new NotFoundException('Rifa no encontrada');
        }

        if (raffle.estado !== 'ACTIVA') {
          throw new BadRequestException('La rifa no está activa');
        }

        if (raffle.is_hidden) {
          throw new BadRequestException('Esta rifa no está disponible');
        }

        if (raffle.seller_id === userId) {
          throw new BadRequestException(
            'No podés comprar tickets de tu propia rifa',
          );
        }

        // Check user's ticket count within transaction
        const userTicketCount = await tx.ticket.count({
          where: {
            buyerId: userId,
            raffleId,
            estado: { not: 'REEMBOLSADO' },
          },
        });

        const maxAllowed = Math.floor(
          raffle.total_tickets * this.MAX_TICKET_PERCENTAGE,
        );
        const remainingAllowed = maxAllowed - userTicketCount;

        if (cantidad > remainingAllowed) {
          throw new BadRequestException(
            `Solo puedes comprar ${remainingAllowed} tickets más (límite 50%)`,
          );
        }

        const soldTickets = Number(raffle.sold_count);
        const availableTickets = raffle.total_tickets - soldTickets;

        if (cantidad > availableTickets) {
          throw new BadRequestException(
            `Solo quedan ${availableTickets} tickets disponibles`,
          );
        }

        // Get available ticket numbers within transaction
        const usedTickets = await tx.ticket.findMany({
          where: { raffleId },
          select: { numeroTicket: true },
        });

        const usedNumbers = new Set(usedTickets.map((t) => t.numeroTicket));
        const availableNumbers: number[] = [];

        for (let i = 1; i <= raffle.total_tickets; i++) {
          if (!usedNumbers.has(i)) {
            availableNumbers.push(i);
          }
        }

        const selectedNumbers = availableNumbers.slice(0, cantidad);

        if (selectedNumbers.length < cantidad) {
          throw new BadRequestException(
            'No hay suficientes tickets disponibles',
          );
        }

        const grossSubtotal = Number(raffle.precio_por_ticket) * cantidad;

        // Create tickets in RESERVADO state (will be confirmed by webhook)
        const tickets = await Promise.all(
          selectedNumbers.map((numeroTicket) =>
            tx.ticket.create({
              data: {
                raffleId,
                numeroTicket,
                buyerId: userId,
                precioPagado: raffle.precio_por_ticket,
                estado: 'RESERVADO',
                mpExternalReference: reservationId,
              },
            }),
          ),
        );

        this.logger.log(
          `User ${userId} reserved ${cantidad} tickets for raffle ${raffleId}`,
        );

        const reservedBonus =
          await this.socialPromotionsService.reserveBonusForCheckout(
            {
              buyerId: userId,
              raffleId,
              raffleSellerId: raffle.seller_id,
              reservationId,
              grossSubtotal,
              bonusGrantId,
            },
            tx,
          );

        // Create Mercado Pago preference (outside transaction is ok)
        const { initPoint, preferenceId } =
          await this.paymentsService.createPreference({
            raffleId,
            cantidad,
            buyerId: userId,
            precioPorTicket: Number(raffle.precio_por_ticket),
            tituloRifa: raffle.titulo,
            reservationId,
            grossSubtotal,
            discountApplied: reservedBonus?.preview.discountApplied ?? 0,
            mpChargeAmount:
              reservedBonus?.preview.mpChargeAmount ?? grossSubtotal,
            bonusGrantId: reservedBonus?.grant.id ?? null,
            promotionBonusRedemptionId: reservedBonus?.redemption.id ?? null,
            promotionToken: promotionToken ?? null,
          });

        return {
          tickets,
          initPoint, // MP checkout URL
          preferenceId,
          totalAmount: reservedBonus?.preview.mpChargeAmount ?? grossSubtotal,
          grossSubtotal,
          discountApplied: reservedBonus?.preview.discountApplied ?? 0,
          mpChargeAmount:
            reservedBonus?.preview.mpChargeAmount ?? grossSubtotal,
          bonusGrantId: reservedBonus?.grant.id ?? null,
          cantidadComprada: cantidad,
          ticketsRestantesQuePuedeComprar: remainingAllowed - cantidad,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      },
    );
  }

  async confirmTicketPurchase(mpPaymentId: string) {
    return this.prisma.ticket.updateMany({
      where: { mpPaymentId, estado: 'RESERVADO' },
      data: { estado: 'PAGADO' },
    });
  }

  async refundTickets(raffleId: string) {
    const tickets = await this.prisma.ticket.findMany({
      where: { raffleId, estado: 'PAGADO' },
    });

    const successfulRefundIds: string[] = [];
    const failedTicketIds: string[] = [];

    for (const ticket of tickets) {
      if (!ticket.mpPaymentId) {
        failedTicketIds.push(ticket.id);
        this.logger.error(
          `Cannot refund ticket ${ticket.id}: missing mpPaymentId`,
        );
        continue;
      }

      const success = await this.paymentsService.refundPayment(
        ticket.mpPaymentId,
      );
      if (success) {
        successfulRefundIds.push(ticket.id);
      } else {
        failedTicketIds.push(ticket.id);
      }
    }

    const result =
      successfulRefundIds.length > 0
        ? await this.prisma.ticket.updateMany({
            where: { id: { in: successfulRefundIds }, estado: 'PAGADO' },
            data: { estado: 'REEMBOLSADO' },
          })
        : { count: 0 };

    if (failedTicketIds.length > 0) {
      this.logger.warn(
        `Refund failed for ${failedTicketIds.length} ticket(s) in raffle ${raffleId}: ${failedTicketIds.join(', ')}`,
      );
    }

    // Emit refunded events grouped by buyer
    const ticketsByBuyer = new Map<string, { count: number; amount: number }>();
    const successfulIds = new Set(successfulRefundIds);
    for (const ticket of tickets.filter((t) => successfulIds.has(t.id))) {
      const existing = ticketsByBuyer.get(ticket.buyerId) || {
        count: 0,
        amount: 0,
      };
      existing.count += 1;
      existing.amount += Number(ticket.precioPagado);
      ticketsByBuyer.set(ticket.buyerId, existing);
    }

    for (const [buyerId, data] of ticketsByBuyer) {
      this.eventEmitter.emit(
        RaffleEvents.TICKETS_REFUNDED,
        new TicketsRefundedEvent(raffleId, buyerId, data.count, data.amount),
      );
    }

    return result;
  }

  async getUserTicketCount(userId: string, raffleId: string) {
    return this.prisma.ticket.count({
      where: {
        buyerId: userId,
        raffleId,
        estado: { not: 'REEMBOLSADO' },
      },
    });
  }

  async getAvailableTicketNumbers(raffleId: string, totalTickets: number) {
    const usedTickets = await this.prisma.ticket.findMany({
      where: { raffleId },
      select: { numeroTicket: true },
    });

    const usedNumbers = new Set(usedTickets.map((t) => t.numeroTicket));
    const availableNumbers: number[] = [];

    for (let i = 1; i <= totalTickets; i++) {
      if (!usedNumbers.has(i)) {
        availableNumbers.push(i);
      }
    }

    return availableNumbers;
  }

  async findByUser(userId: string) {
    return this.prisma.ticket.findMany({
      where: { buyerId: userId },
      include: { raffle: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, requesterId: string, requesterRole: UserRole) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        raffle: { include: { product: true } },
        buyer: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }

    const isAdmin = requesterRole === UserRole.ADMIN;
    const isOwner = ticket.buyerId === requesterId;
    const isSeller = ticket.raffle.sellerId === requesterId;

    if (!isAdmin && !isOwner && !isSeller) {
      throw new ForbiddenException('No tienes permisos para ver este ticket');
    }

    return ticket;
  }
}

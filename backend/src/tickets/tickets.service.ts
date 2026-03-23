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
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { Prisma, RaffleStatus, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { RaffleEvents, TicketsRefundedEvent } from '../common/events';
import { SocialPromotionsService } from '../social-promotions/social-promotions.service';
import { TicketPurchaseMode } from '../common/enums';

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

interface ReserveTicketsOptions {
  userId: string;
  raffleId: string;
  purchaseMode: TicketPurchaseMode;
  cantidad?: number;
  selectedNumbers?: number[];
  bonusGrantId?: string | null;
  promotionToken?: string | null;
}

/**
 * Handles ticket reservation, refund, and read access rules around raffle participation.
 */
@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);
  private readonly MAX_TICKET_PERCENTAGE = 0.5; // 50%

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    @Inject(forwardRef(() => PaymentsService))
    private paymentsService: PaymentsService,
    private socialPromotionsService: SocialPromotionsService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Reserves ticket numbers inside a serializable transaction and returns checkout data for payment.
   */
  async buyTickets(
    userId: string,
    raffleId: string,
    cantidad: number,
    bonusGrantId?: string | null,
    promotionToken?: string | null,
  ) {
    return this.reserveTicketsForCheckout({
      userId,
      raffleId,
      cantidad,
      bonusGrantId,
      promotionToken,
      purchaseMode: TicketPurchaseMode.RANDOM,
    });
  }

  /**
   * Reserves exact ticket numbers inside a serializable transaction and returns checkout data.
   */
  async buySelectedTickets(
    userId: string,
    raffleId: string,
    selectedNumbers: number[],
    bonusGrantId?: string | null,
    promotionToken?: string | null,
  ) {
    this.validateSelectedNumbers(selectedNumbers);

    return this.reserveTicketsForCheckout({
      userId,
      raffleId,
      selectedNumbers,
      bonusGrantId,
      promotionToken,
      purchaseMode: TicketPurchaseMode.CHOOSE_NUMBERS,
    });
  }

  /**
   * Marks reserved tickets as paid for a confirmed payment identifier.
   */
  async confirmTicketPurchase(mpPaymentId: string) {
    return this.prisma.ticket.updateMany({
      where: { mpPaymentId, estado: 'RESERVADO' },
      data: { estado: 'PAGADO' },
    });
  }

  /**
   * Refunds all paid tickets in a raffle and emits grouped refund events for affected buyers.
   */
  async refundTickets(raffleId: string) {
    const tickets = await this.prisma.ticket.findMany({
      where: { raffleId, estado: 'PAGADO' },
    });

    const successfulRefundIds: string[] = [];
    const failedTicketIds: string[] = [];
    const refundTotalsByBuyer = new Map<
      string,
      { count: number; amount: number }
    >();

    const ticketsByPayment = new Map<
      string,
      {
        buyerId: string;
        ticketIds: string[];
        ticketCount: number;
        fallbackAmount: number;
      }
    >();

    for (const ticket of tickets) {
      if (!ticket.mpPaymentId) {
        failedTicketIds.push(ticket.id);
        this.logger.error(
          `Cannot refund ticket ${ticket.id}: missing mpPaymentId`,
        );
        continue;
      }

      const existing = ticketsByPayment.get(ticket.mpPaymentId) ?? {
        buyerId: ticket.buyerId,
        ticketIds: [],
        ticketCount: 0,
        fallbackAmount: 0,
      };
      existing.ticketIds.push(ticket.id);
      existing.ticketCount += 1;
      existing.fallbackAmount += Number(ticket.precioPagado);
      ticketsByPayment.set(ticket.mpPaymentId, existing);
    }

    const paymentIds = Array.from(ticketsByPayment.keys());
    const transactionAmounts =
      paymentIds.length > 0
        ? await this.prisma.transaction.findMany({
            where: {
              mpPaymentId: { in: paymentIds },
              tipo: 'COMPRA_TICKET',
              estado: 'COMPLETADO',
              isDeleted: false,
            },
            select: {
              mpPaymentId: true,
              cashChargedAmount: true,
            },
          })
        : [];
    const chargedAmountByPaymentId = new Map(
      (transactionAmounts ?? [])
        .filter((transaction) => transaction.mpPaymentId)
        .map((transaction) => [
          transaction.mpPaymentId as string,
          Number(transaction.cashChargedAmount ?? 0),
        ]),
    );

    for (const [mpPaymentId, paymentGroup] of ticketsByPayment) {
      const success = await this.paymentsService.refundPayment(mpPaymentId);
      if (!success) {
        failedTicketIds.push(...paymentGroup.ticketIds);
        continue;
      }

      successfulRefundIds.push(...paymentGroup.ticketIds);

      const existingBuyerTotal = refundTotalsByBuyer.get(
        paymentGroup.buyerId,
      ) ?? {
        count: 0,
        amount: 0,
      };
      existingBuyerTotal.count += paymentGroup.ticketCount;
      existingBuyerTotal.amount +=
        chargedAmountByPaymentId.get(mpPaymentId) ??
        paymentGroup.fallbackAmount;
      refundTotalsByBuyer.set(paymentGroup.buyerId, existingBuyerTotal);
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

    for (const [buyerId, data] of refundTotalsByBuyer) {
      this.eventEmitter.emit(
        RaffleEvents.TICKETS_REFUNDED,
        new TicketsRefundedEvent(raffleId, buyerId, data.count, data.amount),
      );
    }

    return result;
  }

  /**
   * Counts how many non-refunded tickets a user already holds in a raffle.
   */
  async getUserTicketCount(userId: string, raffleId: string) {
    return this.prisma.ticket.count({
      where: {
        buyerId: userId,
        raffleId,
        estado: { not: 'REEMBOLSADO' },
      },
    });
  }

  /**
   * Returns the currently free ticket numbers for a raffle.
   */
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

  /**
   * Returns paginated availability for the chosen-number purchase picker.
   */
  async getTicketNumberAvailability(
    raffleId: string,
    page: number,
    pageSize: number,
    searchNumber?: number,
  ) {
    const normalizedPage = Math.max(1, Math.trunc(page));
    const normalizedPageSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));

    const raffle = await this.prisma.raffle.findUnique({
      where: { id: raffleId },
      select: {
        id: true,
        estado: true,
        isHidden: true,
        totalTickets: true,
      },
    });

    if (!raffle) {
      throw new NotFoundException('Rifa no encontrada');
    }

    if (raffle.estado !== 'ACTIVA' || raffle.isHidden) {
      throw new BadRequestException('Esta rifa no está disponible');
    }

    if (
      typeof searchNumber === 'number' &&
      (!Number.isInteger(searchNumber) ||
        searchNumber < 1 ||
        searchNumber > raffle.totalTickets)
    ) {
      throw new BadRequestException('Número de ticket fuera de rango');
    }

    const takenNumbers = await this.prisma.ticket.findMany({
      where: { raffleId },
      select: { numeroTicket: true },
    });
    const takenSet = new Set(takenNumbers.map((ticket) => ticket.numeroTicket));
    const totalPages = Math.max(
      1,
      Math.ceil(raffle.totalTickets / normalizedPageSize),
    );
    const premiumPercent = this.getSelectedNumberPremiumPercent();

    if (typeof searchNumber === 'number') {
      return {
        items: [
          {
            number: searchNumber,
            isAvailable: !takenSet.has(searchNumber),
          },
        ],
        totalTickets: raffle.totalTickets,
        page: Math.ceil(searchNumber / normalizedPageSize),
        pageSize: normalizedPageSize,
        totalPages,
        availableCount: raffle.totalTickets - takenSet.size,
        maxSelectable: Math.floor(
          raffle.totalTickets * this.MAX_TICKET_PERCENTAGE,
        ),
        premiumPercent,
      };
    }

    const boundedPage = Math.min(normalizedPage, totalPages);
    const startNumber = (boundedPage - 1) * normalizedPageSize + 1;
    const endNumber = Math.min(
      raffle.totalTickets,
      startNumber + normalizedPageSize - 1,
    );

    const items = Array.from(
      { length: endNumber - startNumber + 1 },
      (_, index) => {
        const number = startNumber + index;
        return {
          number,
          isAvailable: !takenSet.has(number),
        };
      },
    );

    return {
      items,
      totalTickets: raffle.totalTickets,
      page: boundedPage,
      pageSize: normalizedPageSize,
      totalPages,
      availableCount: raffle.totalTickets - takenSet.size,
      maxSelectable: Math.floor(
        raffle.totalTickets * this.MAX_TICKET_PERCENTAGE,
      ),
      premiumPercent,
    };
  }

  /**
   * Lists the current user's tickets with raffle and product context.
   */
  async findByUser(userId: string) {
    return this.prisma.ticket.findMany({
      where: { buyerId: userId },
      include: { raffle: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Returns a single ticket when the requester is the buyer, seller, or an admin.
   */
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

  private getSelectedNumberPremiumPercent(): number {
    const configuredPercent = Number(
      this.configService.get<number | string>(
        'SELECTED_NUMBER_PREMIUM_PERCENT',
      ) ?? 5,
    );

    return Number.isFinite(configuredPercent) && configuredPercent >= 0
      ? configuredPercent
      : 5;
  }

  private validateSelectedNumbers(selectedNumbers: number[]): void {
    if (selectedNumbers.length === 0) {
      throw new BadRequestException(
        'Debes elegir al menos un número para continuar',
      );
    }

    if (selectedNumbers.some((number) => !Number.isInteger(number))) {
      throw new BadRequestException(
        'Todos los números seleccionados deben ser enteros',
      );
    }

    if (new Set(selectedNumbers).size !== selectedNumbers.length) {
      throw new BadRequestException('No podés elegir números repetidos');
    }
  }

  private async ensureBuyerHasShippingAddress(userId: string): Promise<void> {
    const buyerAddressCount = await this.prisma.shippingAddress.count({
      where: { userId },
    });

    if (buyerAddressCount === 0) {
      throw new BadRequestException(
        'Debes agregar una dirección de envío antes de comprar tickets. Si ganas, necesitamos saber dónde enviarte el premio.',
      );
    }
  }

  private async reserveTicketsForCheckout({
    userId,
    raffleId,
    cantidad,
    selectedNumbers,
    bonusGrantId,
    promotionToken,
    purchaseMode,
  }: ReserveTicketsOptions) {
    await this.ensureBuyerHasShippingAddress(userId);

    await this.paymentsService.expireSupersededInitiatedMockPaymentsForRaffle(
      userId,
      raffleId,
    );

    return this.prisma.$transaction(
      async (tx) => {
        const reservationId = randomUUID();
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
        const remainingAllowed = Math.max(0, maxAllowed - userTicketCount);

        const usedTickets = await tx.ticket.findMany({
          where: { raffleId },
          select: { numeroTicket: true },
        });
        const usedNumbers = new Set(
          (usedTickets ?? []).map((ticket) => ticket.numeroTicket),
        );
        const soldTickets = Number(raffle.sold_count);
        const availableTickets = raffle.total_tickets - soldTickets;

        const normalizedSelectedNumbers =
          purchaseMode === TicketPurchaseMode.CHOOSE_NUMBERS
            ? (selectedNumbers ?? []).map((number) => Math.trunc(number))
            : [];
        const requestedCount =
          purchaseMode === TicketPurchaseMode.CHOOSE_NUMBERS
            ? normalizedSelectedNumbers.length
            : Math.trunc(cantidad ?? 0);

        if (!Number.isInteger(requestedCount) || requestedCount < 1) {
          throw new BadRequestException(
            'Debes comprar al menos un ticket para continuar',
          );
        }

        if (requestedCount > remainingAllowed) {
          throw new BadRequestException(
            `Solo puedes comprar ${remainingAllowed} tickets más (límite 50%)`,
          );
        }

        if (requestedCount > availableTickets) {
          throw new BadRequestException(
            `Solo quedan ${availableTickets} tickets disponibles`,
          );
        }

        if (purchaseMode === TicketPurchaseMode.CHOOSE_NUMBERS) {
          const outOfRangeNumbers = normalizedSelectedNumbers.filter(
            (number) => number < 1 || number > raffle.total_tickets,
          );
          if (outOfRangeNumbers.length > 0) {
            throw new BadRequestException(
              `Los siguientes números están fuera de rango: ${outOfRangeNumbers.join(', ')}`,
            );
          }
        }

        const reservedNumbers =
          purchaseMode === TicketPurchaseMode.CHOOSE_NUMBERS
            ? normalizedSelectedNumbers
            : this.getRandomAvailableNumbers(
                usedNumbers,
                raffle.total_tickets,
                requestedCount,
              );

        if (purchaseMode === TicketPurchaseMode.CHOOSE_NUMBERS) {
          const unavailableSelectedNumbers = reservedNumbers.filter((number) =>
            usedNumbers.has(number),
          );
          if (unavailableSelectedNumbers.length > 0) {
            throw new BadRequestException(
              `Los siguientes números ya no están disponibles: ${unavailableSelectedNumbers.join(', ')}`,
            );
          }
        }

        if (reservedNumbers.length < requestedCount) {
          throw new BadRequestException(
            'No hay suficientes tickets disponibles',
          );
        }

        const baseTicketPrice = new Prisma.Decimal(raffle.precio_por_ticket);
        const grossSubtotal = Number(
          baseTicketPrice.mul(requestedCount).toFixed(2),
        );
        const selectionPremiumPercent =
          purchaseMode === TicketPurchaseMode.CHOOSE_NUMBERS
            ? this.getSelectedNumberPremiumPercent()
            : 0;
        const selectionPremiumPerTicket =
          selectionPremiumPercent > 0
            ? Number(
                baseTicketPrice
                  .mul(selectionPremiumPercent)
                  .div(100)
                  .toFixed(2),
              )
            : 0;
        const selectionPremiumAmount = Number(
          (selectionPremiumPerTicket * requestedCount).toFixed(2),
        );

        const tickets = await Promise.all(
          reservedNumbers.map((numeroTicket) =>
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
          `User ${userId} reserved ${requestedCount} tickets for raffle ${raffleId} (${purchaseMode})`,
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

        const chargedBaseAmount =
          reservedBonus?.preview.mpChargeAmount ?? grossSubtotal;
        const totalChargeAmount = Number(
          (chargedBaseAmount + selectionPremiumAmount).toFixed(2),
        );

        const { initPoint, preferenceId } =
          await this.paymentsService.createPreference({
            raffleId,
            cantidad: requestedCount,
            buyerId: userId,
            precioPorTicket: Number(raffle.precio_por_ticket),
            tituloRifa: raffle.titulo,
            reservationId,
            grossSubtotal,
            discountApplied: reservedBonus?.preview.discountApplied ?? 0,
            mpChargeAmount: totalChargeAmount,
            bonusGrantId: reservedBonus?.grant.id ?? null,
            promotionBonusRedemptionId: reservedBonus?.redemption.id ?? null,
            promotionToken: promotionToken ?? null,
            purchaseMode,
            selectedNumbers:
              purchaseMode === TicketPurchaseMode.CHOOSE_NUMBERS
                ? reservedNumbers
                : null,
            selectionPremiumPercent,
            selectionPremiumAmount,
          });

        return {
          tickets,
          initPoint,
          preferenceId,
          totalAmount: totalChargeAmount,
          grossSubtotal,
          discountApplied: reservedBonus?.preview.discountApplied ?? 0,
          mpChargeAmount: totalChargeAmount,
          bonusGrantId: reservedBonus?.grant.id ?? null,
          cantidadComprada: requestedCount,
          ticketsRestantesQuePuedeComprar: Math.max(
            0,
            remainingAllowed - requestedCount,
          ),
          purchaseMode,
          selectionPremiumPercent,
          selectionPremiumAmount,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      },
    );
  }

  private getRandomAvailableNumbers(
    usedNumbers: Set<number>,
    totalTickets: number,
    cantidad: number,
  ): number[] {
    const availableNumbers: number[] = [];

    for (let number = 1; number <= totalTickets; number += 1) {
      if (!usedNumbers.has(number)) {
        availableNumbers.push(number);
      }
    }

    return availableNumbers.slice(0, cantidad);
  }
}

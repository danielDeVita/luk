import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  RaffleStatus,
  UserRole,
  WalletLedgerEntryType,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  RaffleEvents,
  RaffleCompletedEvent,
  RaffleDrawnEvent,
  TicketsPurchasedEvent,
  TicketsRefundedEvent,
} from '../common/events';
import { SocialPromotionsService } from '../social-promotions/social-promotions.service';
import { TicketPurchaseMode } from '../common/enums';
import { BuyTicketsResult } from './entities/buy-tickets-result.entity';
import { evaluateSimpleRandomPack } from './pack-simple.util';
import { selectRandomAvailableNumbers } from './random-ticket-selection.util';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';
import { getPlatformFeeRate } from '../common/config/platform-fee.util';
import { PayoutsService } from '../payouts/payouts.service';

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
  private readonly platformFeeRate: number;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private walletService: WalletService,
    private socialPromotionsService: SocialPromotionsService,
    private notificationsService: NotificationsService,
    private activityService: ActivityService,
    private payoutsService: PayoutsService,
    private eventEmitter: EventEmitter2,
  ) {
    this.platformFeeRate = getPlatformFeeRate(this.configService);
  }

  /**
   * Reserves ticket numbers inside a serializable transaction and returns checkout data for payment.
   */
  async buyTickets(
    userId: string,
    raffleId: string,
    cantidad: number,
    bonusGrantId?: string | null,
    promotionToken?: string | null,
  ): Promise<BuyTicketsResult> {
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
  ): Promise<BuyTicketsResult> {
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
   * Refunds all paid tickets in a raffle and emits grouped refund events for affected buyers.
   */
  async refundTickets(raffleId: string) {
    const refundTotalsByBuyer = await this.prisma.$transaction(
      async (tx) => {
        const raffle = await tx.raffle.findUnique({
          where: { id: raffleId },
          select: { sellerId: true },
        });
        if (!raffle) {
          throw new NotFoundException('Rifa no encontrada');
        }

        const tickets = await tx.ticket.findMany({
          where: { raffleId, estado: 'PAGADO' },
        });
        const groupedByBuyer = new Map<
          string,
          { ticketIds: string[]; count: number; amount: number }
        >();

        for (const ticket of tickets) {
          const group = groupedByBuyer.get(ticket.buyerId) ?? {
            ticketIds: [],
            count: 0,
            amount: 0,
          };
          group.ticketIds.push(ticket.id);
          group.count += 1;
          group.amount += Number(ticket.precioPagado);
          groupedByBuyer.set(ticket.buyerId, group);
        }

        for (const [buyerId, group] of groupedByBuyer) {
          await this.walletService.creditUserBalance(
            tx,
            buyerId,
            group.amount,
            WalletLedgerEntryType.TICKET_PURCHASE_REFUND,
            { raffleId },
          );
        }

        const totalRefund = Array.from(groupedByBuyer.values()).reduce(
          (sum, group) => sum + group.amount,
          0,
        );
        if (totalRefund > 0) {
          await this.walletService.debitSellerPayable(
            tx,
            raffle.sellerId,
            totalRefund,
            { raffleId, metadata: { reason: 'ticket_refund' } },
          );
        }

        const ticketIds = Array.from(groupedByBuyer.values()).flatMap(
          (group) => group.ticketIds,
        );
        if (ticketIds.length > 0) {
          await tx.ticket.updateMany({
            where: { id: { in: ticketIds }, estado: 'PAGADO' },
            data: { estado: 'REEMBOLSADO' },
          });
        }

        return groupedByBuyer;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      },
    );

    for (const [buyerId, data] of refundTotalsByBuyer) {
      this.eventEmitter.emit(
        RaffleEvents.TICKETS_REFUNDED,
        new TicketsRefundedEvent(raffleId, buyerId, data.count, data.amount),
      );
    }

    const refundedCount = Array.from(refundTotalsByBuyer.values()).reduce(
      (sum, group) => sum + group.count,
      0,
    );
    return { count: refundedCount };
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
      include: { raffle: { include: { product: true, review: true } } },
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
  }: ReserveTicketsOptions): Promise<BuyTicketsResult> {
    await this.ensureBuyerHasShippingAddress(userId);

    const result = await this.prisma.$transaction(
      async (tx) => {
        const purchaseReference = `wallet_purchase_${randomUUID().replace(/-/g, '')}`;
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

        const packEvaluation = evaluateSimpleRandomPack({
          purchaseMode,
          requestedQuantity: requestedCount,
          availableTickets,
          remainingAllowed,
        });
        const reservedTicketCount = packEvaluation.grantedQuantity;

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
                reservedTicketCount,
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

        if (reservedNumbers.length < reservedTicketCount) {
          throw new BadRequestException(
            'No hay suficientes tickets disponibles',
          );
        }

        const baseTicketPrice = new Prisma.Decimal(raffle.precio_por_ticket);
        const grossSubtotal = Number(
          baseTicketPrice.mul(reservedTicketCount).toFixed(2),
        );
        const packDiscountApplied = Number(
          baseTicketPrice.mul(packEvaluation.bonusQuantity).toFixed(2),
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
                estado: 'PAGADO',
                purchaseReference,
              },
            }),
          ),
        );
        const normalizedTickets = tickets.map((ticket) => ({
          ...ticket,
          precioPagado: Number(ticket.precioPagado),
        }));

        this.logger.log(
          `User ${userId} reserved ${reservedTicketCount} tickets for raffle ${raffleId} (${purchaseMode}, base=${requestedCount}, bonus=${packEvaluation.bonusQuantity})`,
        );

        const canUsePromotionBonus = !packEvaluation.packApplied;
        const reservedBonus = canUsePromotionBonus
          ? await this.socialPromotionsService.reserveBonusForCheckout(
              {
                buyerId: userId,
                raffleId,
                raffleSellerId: raffle.seller_id,
                reservationId: purchaseReference,
                grossSubtotal,
                bonusGrantId,
              },
              tx,
            )
          : null;

        const promotionDiscountApplied =
          reservedBonus?.preview.discountApplied ?? 0;
        const chargedBaseAmount =
          reservedBonus?.preview.chargedAmount ??
          Number((grossSubtotal - packDiscountApplied).toFixed(2));
        const totalDiscountApplied = Number(
          (packDiscountApplied + promotionDiscountApplied).toFixed(2),
        );
        const totalChargeAmount = Number(
          (chargedBaseAmount + selectionPremiumAmount).toFixed(2),
        );

        const buyerWallet = await this.walletService.debitUserBalance(
          tx,
          userId,
          totalChargeAmount,
          WalletLedgerEntryType.TICKET_PURCHASE_DEBIT,
          {
            raffleId,
            metadata: {
              purchaseReference,
              baseQuantity: requestedCount,
              bonusQuantity: packEvaluation.bonusQuantity,
              grantedQuantity: reservedTicketCount,
              packApplied: packEvaluation.packApplied,
              promotionDiscountApplied,
              packDiscountApplied,
            },
          },
        );

        const platformFee = Number(
          (grossSubtotal * this.platformFeeRate).toFixed(2),
        );
        const sellerPayableAmount = Number(
          (grossSubtotal - platformFee).toFixed(2),
        );
        await this.walletService.creditSellerPayable(
          tx,
          raffle.seller_id,
          sellerPayableAmount,
          {
            raffleId,
            metadata: {
              purchaseReference,
              grossSubtotal,
              platformFee,
            },
          },
        );

        await tx.transaction.create({
          data: {
            tipo: 'COMPRA_TICKET',
            userId,
            raffleId,
            monto: totalChargeAmount,
            grossAmount: grossSubtotal,
            promotionDiscountAmount: promotionDiscountApplied,
            cashChargedAmount: totalChargeAmount,
            comisionPlataforma: platformFee,
            feeProcesamiento: 0,
            montoNeto: sellerPayableAmount,
            estado: 'COMPLETADO',
            metadata: {
              purchaseReference,
              baseQuantity: requestedCount,
              bonusQuantity: packEvaluation.bonusQuantity,
              grantedQuantity: reservedTicketCount,
              packApplied: packEvaluation.packApplied,
              packIneligibilityReason:
                packEvaluation.packIneligibilityReason ?? null,
              packDiscountApplied,
              promotionDiscountApplied,
              discountApplied: totalDiscountApplied,
              purchaseMode,
              selectedNumbers:
                purchaseMode === TicketPurchaseMode.CHOOSE_NUMBERS
                  ? reservedNumbers
                  : null,
              selectionPremiumPercent,
              selectionPremiumAmount,
            },
          },
        });

        await tx.ticketPurchaseReceipt.create({
          data: {
            purchaseReference,
            buyerId: userId,
            raffleId,
            raffleTitleSnapshot: raffle.titulo,
            ticketNumbers: reservedNumbers,
            grossSubtotal,
            packDiscountAmount: packDiscountApplied,
            promotionDiscountAmount: promotionDiscountApplied,
            selectionPremiumPercent,
            selectionPremiumAmount,
            chargedAmount: totalChargeAmount,
            baseQuantity: requestedCount,
            bonusQuantity: packEvaluation.bonusQuantity,
            grantedQuantity: reservedTicketCount,
            packApplied: packEvaluation.packApplied,
            purchaseMode,
          },
        });

        if (packDiscountApplied > 0) {
          await tx.transaction.create({
            data: {
              tipo: 'SUBSIDIO_PACK_PLATAFORMA',
              userId,
              raffleId,
              monto: packDiscountApplied,
              grossAmount: grossSubtotal,
              promotionDiscountAmount: packDiscountApplied,
              cashChargedAmount: totalChargeAmount,
              comisionPlataforma: 0,
              feeProcesamiento: 0,
              montoNeto: packDiscountApplied,
              estado: 'COMPLETADO',
              metadata: { purchaseReference },
            },
          });
        }

        if (promotionDiscountApplied > 0) {
          await tx.transaction.create({
            data: {
              tipo: 'SUBSIDIO_PROMOCIONAL_PLATAFORMA',
              userId,
              raffleId,
              monto: promotionDiscountApplied,
              grossAmount: grossSubtotal,
              promotionDiscountAmount: promotionDiscountApplied,
              cashChargedAmount: totalChargeAmount,
              comisionPlataforma: 0,
              feeProcesamiento: 0,
              montoNeto: promotionDiscountApplied,
              estado: 'COMPLETADO',
              metadata: { purchaseReference },
            },
          });
        }

        await this.socialPromotionsService.markRedemptionUsedByReservation({
          reservationId: purchaseReference,
          bonusGrantId: reservedBonus?.grant.id ?? null,
          purchaseReference,
        });
        await this.socialPromotionsService.recordPurchaseAttribution(
          userId,
          promotionToken ?? undefined,
          reservedTicketCount,
          totalChargeAmount,
        );

        if (reservedTicketCount > 0) {
          await tx.userReputation.upsert({
            where: { userId },
            create: {
              userId,
              totalTicketsComprados: reservedTicketCount,
            },
            update: {
              totalTicketsComprados: { increment: reservedTicketCount },
            },
          });
        }

        return {
          tickets: normalizedTickets,
          purchaseReference,
          paidWithCredit: true,
          creditDebited: totalChargeAmount,
          creditBalanceAfter: Number(buyerWallet.creditBalance),
          totalAmount: totalChargeAmount,
          grossSubtotal,
          discountApplied: totalDiscountApplied,
          chargedAmount: totalChargeAmount,
          bonusGrantId: reservedBonus?.grant.id ?? undefined,
          cantidadComprada: requestedCount,
          baseQuantity: requestedCount,
          bonusQuantity: packEvaluation.bonusQuantity,
          grantedQuantity: reservedTicketCount,
          packApplied: packEvaluation.packApplied,
          packIneligibilityReason: packEvaluation.packIneligibilityReason,
          ticketsRestantesQuePuedeComprar: Math.max(
            0,
            remainingAllowed - reservedTicketCount,
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

    await this.handleWalletTicketPurchaseSideEffects(raffleId, userId, result);
    return result;
  }

  private async handleWalletTicketPurchaseSideEffects(
    raffleId: string,
    buyerId: string,
    result: BuyTicketsResult,
  ): Promise<void> {
    const ticketNumbers = result.tickets.map((ticket) => ticket.numeroTicket);
    const purchaseIncludesPack = result.packApplied && result.bonusQuantity > 0;

    try {
      const [buyer, raffle] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: buyerId },
          select: { email: true, nombre: true },
        }),
        this.prisma.raffle.findUnique({
          where: { id: raffleId },
          select: {
            id: true,
            titulo: true,
            sellerId: true,
            totalTickets: true,
            seller: {
              select: { id: true, email: true, nombre: true, apellido: true },
            },
            tickets: {
              where: { estado: 'PAGADO' },
              select: { id: true },
            },
          },
        }),
      ]);

      if (!buyer || !raffle) {
        return;
      }

      await this.notificationsService.sendTicketPurchaseConfirmation(
        buyer.email,
        {
          raffleName: raffle.titulo,
          purchaseReference: result.purchaseReference,
          ticketNumbers,
          amount: result.chargedAmount,
          packApplied: purchaseIncludesPack,
          baseQuantity: purchaseIncludesPack ? result.baseQuantity : undefined,
          bonusQuantity: purchaseIncludesPack
            ? result.bonusQuantity
            : undefined,
          grantedQuantity: purchaseIncludesPack
            ? result.grantedQuantity
            : undefined,
          subsidyAmount: purchaseIncludesPack
            ? result.discountApplied
            : undefined,
        },
      );

      await this.notificationsService.create(
        buyerId,
        'PURCHASE',
        '¡Compra confirmada!',
        purchaseIncludesPack
          ? `Usaste Saldo LUK para pagar ${result.baseQuantity} ticket(s) de "${raffle.titulo}" y recibiste ${result.grantedQuantity} en total. Números: ${ticketNumbers.join(', ')}.`
          : `Usaste Saldo LUK para comprar ${ticketNumbers.length} ticket(s) de "${raffle.titulo}". Números: ${ticketNumbers.join(', ')}`,
        `/dashboard/tickets/receipts/${result.purchaseReference}`,
      );

      if (raffle.seller) {
        const soldTickets = raffle.tickets.length;
        const sellerName = [raffle.seller.nombre, raffle.seller.apellido]
          .filter(Boolean)
          .join(' ');

        await this.notificationsService.sendSellerTicketPurchasedNotification(
          raffle.seller.email,
          {
            sellerName,
            raffleName: raffle.titulo,
            ticketCount: ticketNumbers.length,
            amount: result.grossSubtotal,
            soldTickets,
            totalTickets: raffle.totalTickets,
            raffleId: raffle.id,
            packApplied: purchaseIncludesPack,
            baseQuantity: purchaseIncludesPack
              ? result.baseQuantity
              : undefined,
            bonusQuantity: purchaseIncludesPack
              ? result.bonusQuantity
              : undefined,
            grantedQuantity: purchaseIncludesPack
              ? result.grantedQuantity
              : undefined,
            subsidyAmount: purchaseIncludesPack
              ? result.discountApplied
              : undefined,
          },
        );

        await this.notificationsService.create(
          raffle.seller.id,
          'INFO',
          '¡Nueva venta!',
          purchaseIncludesPack
            ? `Se emitieron ${result.grantedQuantity} ticket(s) en "${raffle.titulo}". El saldo a liquidar se registró internamente.`
            : `Vendiste ${ticketNumbers.length} ticket(s) en "${raffle.titulo}". El saldo a liquidar se registró internamente.`,
          '/dashboard/sales',
        );
      }

      await this.activityService.logTicketsPurchased(
        buyerId,
        raffleId,
        ticketNumbers,
        result.chargedAmount,
        result.purchaseReference,
      );

      if (raffle.seller) {
        await this.activityService.logPaymentReceived(
          raffle.seller.id,
          raffleId,
          result.grossSubtotal,
        );
      }

      this.eventEmitter.emit(
        RaffleEvents.TICKETS_PURCHASED,
        new TicketsPurchasedEvent(
          raffleId,
          buyerId,
          ticketNumbers.length,
          result.grossSubtotal,
          null,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send purchase side effects: ${message}`);
    }

    await this.checkRaffleCompletion(raffleId);
  }

  private async checkRaffleCompletion(raffleId: string): Promise<void> {
    const raffle = await this.prisma.raffle.findUnique({
      where: { id: raffleId },
      include: { tickets: true },
    });

    if (!raffle) return;

    const paidTickets = raffle.tickets.filter(
      (ticket) => ticket.estado === 'PAGADO',
    );
    if (paidTickets.length < raffle.totalTickets) {
      return;
    }

    if (raffle.estado === 'ACTIVA') {
      await this.prisma.raffle.update({
        where: { id: raffleId },
        data: { estado: 'COMPLETADA' },
      });

      const totalAmount = paidTickets.reduce(
        (sum, ticket) => sum + Number(ticket.precioPagado),
        0,
      );
      this.eventEmitter.emit(
        RaffleEvents.COMPLETED,
        new RaffleCompletedEvent(
          raffleId,
          raffle.sellerId,
          paidTickets.length,
          totalAmount,
        ),
      );
    }

    await this.drawRaffleIfEligible(raffleId);
  }

  async drawRaffleIfEligible(raffleId: string): Promise<boolean> {
    const raffle = await this.prisma.raffle.findUnique({
      where: { id: raffleId },
      include: {
        product: true,
        seller: true,
        winner: true,
        drawResult: true,
        tickets: {
          where: { estado: 'PAGADO' },
          include: { buyer: true },
        },
      },
    });

    if (!raffle || raffle.isDeleted) {
      return false;
    }

    if (!['ACTIVA', 'COMPLETADA'].includes(raffle.estado)) {
      return false;
    }

    if (raffle.drawResult || raffle.winnerId || raffle.tickets.length === 0) {
      return false;
    }

    const randomIndex = Math.floor(Math.random() * raffle.tickets.length);
    const winningTicket = raffle.tickets[randomIndex];

    try {
      const updatedRaffle = await this.prisma.$transaction(async (tx) => {
        await tx.drawResult.create({
          data: {
            raffleId,
            winningTicketId: winningTicket.id,
            winnerId: winningTicket.buyerId,
            method: 'RANDOM_INDEX',
            totalParticipants: raffle.tickets.length,
          },
        });

        return tx.raffle.update({
          where: { id: raffleId },
          data: {
            estado: 'SORTEADA',
            winnerId: winningTicket.buyerId,
            fechaSorteoReal: new Date(),
          },
          include: { product: true, seller: true, winner: true },
        });
      });

      this.eventEmitter.emit(
        RaffleEvents.DRAWN,
        new RaffleDrawnEvent(
          raffleId,
          winningTicket.buyerId,
          winningTicket.numeroTicket,
          raffle.sellerId,
        ),
      );

      await this.notifyDrawResult(updatedRaffle, winningTicket.numeroTicket);
      await this.payoutsService.createPayout(raffleId);
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn(`Draw for raffle ${raffleId} was already persisted`);
        return false;
      }
      throw error;
    }
  }

  private async notifyDrawResult(
    raffle: {
      id: string;
      titulo: string;
      sellerId: string;
      seller: { id: string; email: string };
      winnerId: string | null;
      winner: { id: string; email: string } | null;
      product: { nombre: string } | null;
    },
    winningTicketNumber: number,
  ): Promise<void> {
    if (!raffle.winner || !raffle.winnerId) {
      return;
    }

    await Promise.all([
      this.notificationsService.sendWinnerNotification(raffle.winner.email, {
        raffleName: raffle.titulo,
        productName: raffle.product?.nombre || raffle.titulo,
        sellerEmail: raffle.seller.email,
        winningTicketNumber,
      }),
      this.notificationsService.create(
        raffle.winnerId,
        'WIN',
        '¡Ganaste un sorteo!',
        `¡Felicidades! Ganaste la rifa "${raffle.titulo}" con el número #${winningTicketNumber}. Contactá al vendedor para coordinar la entrega.`,
      ),
      this.notificationsService.sendSellerMustContactWinner(
        raffle.seller.email,
        {
          raffleName: raffle.titulo,
          winnerEmail: raffle.winner.email,
          winningTicketNumber,
        },
      ),
      this.notificationsService.create(
        raffle.seller.id,
        'INFO',
        'Tu rifa tiene ganador',
        `La rifa "${raffle.titulo}" ha finalizado. El número ganador fue el #${winningTicketNumber}. Tenés 48hs para contactar al ganador.`,
      ),
    ]);
  }

  private getRandomAvailableNumbers(
    usedNumbers: Set<number>,
    totalTickets: number,
    cantidad: number,
  ): number[] {
    return selectRandomAvailableNumbers(usedNumbers, totalTickets, cantidad);
  }
}

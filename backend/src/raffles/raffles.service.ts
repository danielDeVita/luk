import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRaffleInput,
  UpdateRaffleInput,
} from './dto/create-raffle.input';
import { RaffleFiltersInput } from './dto/raffle-filters.input';
import { RelaunchRaffleInput } from './dto/relaunch-raffle.input';
import { Prisma } from '@prisma/client';
import { RaffleSort } from '../common/enums';
import {
  PLATFORM_FEE_RATE,
  STRIPE_FEE_RATE,
  STRIPE_FIXED_FEE,
  MIN_SALE_THRESHOLD,
} from '../common/constants/fees.constants';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';
import {
  RaffleEvents,
  RaffleDrawnEvent,
  RaffleCancelledEvent,
  DeliveryConfirmedEvent,
} from '../common/events';
import {
  toTsqueryOr,
  escapePostgresString,
} from '../common/utils/fulltext-search.util';

// Cache configuration
const CACHE_KEYS = {
  RAFFLE_LIST: 'raffles:list',
  RAFFLE_DETAIL: 'raffles:detail',
  FEATURED: 'raffles:featured',
  CATEGORIES: 'raffles:categories',
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class RafflesService {
  private readonly logger = new Logger(RafflesService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private activityService: ActivityService,
    private eventEmitter: EventEmitter2,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  /**
   * Generate cache key for raffle list queries.
   */
  private getCacheKey(
    prefix: string,
    filters?: RaffleFiltersInput,
    page?: number,
    limit?: number,
  ): string {
    const parts = [prefix];
    if (filters) {
      if (filters.estado) parts.push(`estado:${filters.estado}`);
      if (filters.categoria) parts.push(`cat:${filters.categoria}`);
      if (filters.precioMin) parts.push(`min:${filters.precioMin}`);
      if (filters.precioMax) parts.push(`max:${filters.precioMax}`);
      if (filters.sortBy) parts.push(`sort:${filters.sortBy}`);
      if (filters.searchTerm)
        parts.push(`q:${filters.searchTerm.substring(0, 20)}`);
    }
    if (page) parts.push(`p:${page}`);
    if (limit) parts.push(`l:${limit}`);
    return parts.join(':');
  }

  /**
   * Invalidate all raffle-related caches.
   * Called when raffles are created, updated, or deleted.
   */
  async invalidateRaffleCache(raffleId?: string): Promise<void> {
    try {
      // Delete known cache keys
      await Promise.all([
        this.cache.del(CACHE_KEYS.FEATURED),
        this.cache.del(CACHE_KEYS.CATEGORIES),
        this.cache.del(CACHE_KEYS.RAFFLE_LIST),
        raffleId
          ? this.cache.del(`${CACHE_KEYS.RAFFLE_DETAIL}:${raffleId}`)
          : Promise.resolve(),
      ]);
      this.logger.debug(
        `Cache invalidated${raffleId ? ` for raffle ${raffleId}` : ''}`,
      );
    } catch (error) {
      this.logger.warn(`Cache invalidation failed: ${error}`);
    }
  }

  async create(sellerId: string, input: CreateRaffleInput) {
    // Check if seller has MP Connect configured
    const seller = await this.prisma.user.findUnique({
      where: { id: sellerId },
      select: {
        mpConnectStatus: true,
        kycStatus: true,
        defaultSenderAddressId: true,
        shippingAddresses: { take: 1 },
      },
    });

    if (!seller) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (seller.mpConnectStatus !== 'CONNECTED') {
      throw new BadRequestException(
        'Debes conectar tu cuenta de Mercado Pago antes de crear una rifa. Ve a tu perfil para conectarla.',
      );
    }

    // Check if seller has at least one address (for shipping to winner)
    if (
      !seller.defaultSenderAddressId &&
      seller.shippingAddresses.length === 0
    ) {
      throw new BadRequestException(
        'Debes agregar una dirección de envío antes de crear una rifa. Ve a tu perfil para agregarla.',
      );
    }

    // Check if seller has verified KYC
    if (seller.kycStatus !== 'VERIFIED') {
      throw new BadRequestException(
        'Debes completar y verificar tu identidad (KYC) antes de crear una rifa. Ve a Configuración > Perfil para completar tu verificación.',
      );
    }

    const fechaLimite = new Date(input.fechaLimite);

    if (fechaLimite <= new Date()) {
      throw new BadRequestException('Fecha límite debe ser en el futuro');
    }

    const raffle = await this.prisma.raffle.create({
      data: {
        titulo: input.titulo,
        descripcion: input.descripcion,
        sellerId,
        totalTickets: input.totalTickets,
        precioPorTicket: input.precioPorTicket,
        fechaLimiteSorteo: fechaLimite,
        product: {
          create: {
            nombre: input.productData.nombre,
            descripcionDetallada: input.productData.descripcionDetallada,
            categoria: input.productData.categoria,
            condicion: input.productData.condicion,
            imagenes: input.productData.imagenes,
          },
        },
      },
      include: { product: true, seller: true },
    });

    // Log activity (non-blocking)
    this.activityService
      .logRaffleCreated(sellerId, raffle.id, input.titulo)
      .catch((err) => {
        this.logger.error(`Failed to log raffle creation: ${err.message}`);
      });

    // Invalidate cache (non-blocking)
    this.invalidateRaffleCache().catch((err) => {
      this.logger.warn(`Cache invalidation failed: ${err.message}`);
    });

    return raffle;
  }

  async findAll(filters?: RaffleFiltersInput, page = 1, limit = 10) {
    // Use full-text search for search terms (not cached due to complexity)
    if (filters?.searchTerm && filters.searchTerm.trim().length > 0) {
      return this.findAllWithFullTextSearch(filters, page, limit);
    }

    // Check cache first
    const cacheKey = this.getCacheKey(
      CACHE_KEYS.RAFFLE_LIST,
      filters,
      page,
      limit,
    );
    const cached = await this.cache.get<{
      raffles: unknown[];
      total: number;
      page: number;
      limit: number;
    }>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    const where: Prisma.RaffleWhereInput = {};

    if (filters?.estado) {
      where.estado = filters.estado;
    }
    if (filters?.categoria) {
      where.product = {
        categoria: { contains: filters.categoria, mode: 'insensitive' },
      };
    }
    if (filters?.precioMin || filters?.precioMax) {
      where.precioPorTicket = {};
      if (filters.precioMin) where.precioPorTicket.gte = filters.precioMin;
      if (filters.precioMax) where.precioPorTicket.lte = filters.precioMax;
    }

    let orderBy: Prisma.RaffleOrderByWithRelationInput = { createdAt: 'desc' };

    if (filters?.sortBy) {
      switch (filters.sortBy) {
        case RaffleSort.PRICE_ASC:
          orderBy = { precioPorTicket: 'asc' };
          break;
        case RaffleSort.PRICE_DESC:
          orderBy = { precioPorTicket: 'desc' };
          break;
        case RaffleSort.END_DATE_ASC:
          orderBy = { fechaLimiteSorteo: 'asc' };
          break;
        case RaffleSort.END_DATE_DESC:
          orderBy = { fechaLimiteSorteo: 'desc' };
          break;
        case RaffleSort.CREATED_ASC:
          orderBy = { createdAt: 'asc' };
          break;
        case RaffleSort.CREATED_DESC:
          orderBy = { createdAt: 'desc' };
          break;
      }
    }

    const [raffles, total] = await Promise.all([
      this.prisma.raffle.findMany({
        where,
        include: {
          product: true,
          seller: true,
          _count: { select: { tickets: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      }),
      this.prisma.raffle.count({ where }),
    ]);

    const result = { raffles, total, page, limit };

    // Store in cache (non-blocking)
    this.cache.set(cacheKey, result, CACHE_TTL).catch((err) => {
      this.logger.warn(`Cache set failed: ${err}`);
    });

    return result;
  }

  /**
   * Full-text search using PostgreSQL GIN indexes.
   * Falls back to LIKE-based search if the full-text index doesn't exist.
   */
  private async findAllWithFullTextSearch(
    filters: RaffleFiltersInput,
    page: number,
    limit: number,
  ) {
    const searchTerm = filters.searchTerm!;
    const tsquery = toTsqueryOr(searchTerm);

    if (!tsquery) {
      // Empty search term after sanitization, return empty results
      return { raffles: [], total: 0, page, limit };
    }

    const escapedQuery = escapePostgresString(tsquery);

    // Build WHERE clause conditions
    const conditions: string[] = [];

    // Full-text search condition (with fallback LIKE for non-indexed databases)
    conditions.push(`(
      raffle_search_vector(r.titulo, r.descripcion) @@ to_tsquery('spanish', '${escapedQuery}')
      OR r.titulo ILIKE '%${escapePostgresString(searchTerm)}%'
      OR r.descripcion ILIKE '%${escapePostgresString(searchTerm)}%'
    )`);

    if (filters.estado) {
      conditions.push(`r.estado = '${filters.estado}'`);
    }
    if (filters.categoria) {
      conditions.push(
        `p.categoria ILIKE '%${escapePostgresString(filters.categoria)}%'`,
      );
    }
    if (filters.precioMin !== undefined) {
      conditions.push(`r.precio_por_ticket >= ${Number(filters.precioMin)}`);
    }
    if (filters.precioMax !== undefined) {
      conditions.push(`r.precio_por_ticket <= ${Number(filters.precioMax)}`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Build ORDER BY clause
    let orderClause = 'ORDER BY search_rank DESC, r.created_at DESC';
    if (filters.sortBy) {
      switch (filters.sortBy) {
        case RaffleSort.PRICE_ASC:
          orderClause = 'ORDER BY r.precio_por_ticket ASC';
          break;
        case RaffleSort.PRICE_DESC:
          orderClause = 'ORDER BY r.precio_por_ticket DESC';
          break;
        case RaffleSort.END_DATE_ASC:
          orderClause = 'ORDER BY r.fecha_limite_sorteo ASC';
          break;
        case RaffleSort.END_DATE_DESC:
          orderClause = 'ORDER BY r.fecha_limite_sorteo DESC';
          break;
        case RaffleSort.CREATED_ASC:
          orderClause = 'ORDER BY r.created_at ASC';
          break;
        case RaffleSort.CREATED_DESC:
          orderClause = 'ORDER BY r.created_at DESC';
          break;
      }
    }

    const offset = (page - 1) * limit;

    try {
      // Execute full-text search query with ranking
      const raffleIds = await this.prisma.$queryRawUnsafe<
        { id: string; search_rank: number }[]
      >(`
        SELECT
          r.id,
          ts_rank(raffle_search_vector(r.titulo, r.descripcion), to_tsquery('spanish', '${escapedQuery}')) as search_rank
        FROM raffles r
        LEFT JOIN products p ON p.raffle_id = r.id
        ${whereClause}
        ${orderClause}
        LIMIT ${limit} OFFSET ${offset}
      `);

      // Get total count
      const countResult = await this.prisma.$queryRawUnsafe<
        { count: bigint }[]
      >(`
        SELECT COUNT(*) as count
        FROM raffles r
        LEFT JOIN products p ON p.raffle_id = r.id
        ${whereClause}
      `);

      const total = Number(countResult[0]?.count || 0);
      const ids = raffleIds.map((r) => r.id);

      if (ids.length === 0) {
        return { raffles: [], total, page, limit };
      }

      // Fetch full raffle data with relations
      const raffles = await this.prisma.raffle.findMany({
        where: { id: { in: ids } },
        include: {
          product: true,
          seller: true,
          _count: { select: { tickets: true } },
        },
      });

      // Maintain search ranking order
      const raffleMap = new Map(raffles.map((r) => [r.id, r]));
      const orderedRaffles = ids
        .map((id) => raffleMap.get(id))
        .filter((r): r is NonNullable<typeof r> => r !== undefined);

      return { raffles: orderedRaffles, total, page, limit };
    } catch (error) {
      // If full-text search fails (e.g., function doesn't exist), fall back to LIKE
      this.logger.warn(
        `Full-text search failed, falling back to LIKE search: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      const where: Prisma.RaffleWhereInput = {
        OR: [
          { titulo: { contains: searchTerm, mode: 'insensitive' } },
          { descripcion: { contains: searchTerm, mode: 'insensitive' } },
        ],
      };

      if (filters.estado) {
        where.estado = filters.estado;
      }
      if (filters.categoria) {
        where.product = {
          categoria: { contains: filters.categoria, mode: 'insensitive' },
        };
      }
      if (filters.precioMin || filters.precioMax) {
        where.precioPorTicket = {};
        if (filters.precioMin) where.precioPorTicket.gte = filters.precioMin;
        if (filters.precioMax) where.precioPorTicket.lte = filters.precioMax;
      }

      const [raffles, total] = await Promise.all([
        this.prisma.raffle.findMany({
          where,
          include: {
            product: true,
            seller: true,
            _count: { select: { tickets: true } },
          },
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.raffle.count({ where }),
      ]);

      return { raffles, total, page, limit };
    }
  }

  async findOne(id: string) {
    this.logger.debug(`Finding raffle with ID: ${id}`);
    const raffle = await this.prisma.raffle.findUnique({
      where: { id },
      include: {
        product: true,
        seller: true,
        tickets: true,
        winner: true,
        dispute: true,
      },
    });

    if (!raffle) {
      throw new NotFoundException('Rifa no encontrada');
    }

    return raffle;
  }

  async findByUser(userId: string) {
    return this.prisma.raffle.findMany({
      where: { sellerId: userId },
      include: { product: true, _count: { select: { tickets: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, userId: string, input: UpdateRaffleInput) {
    const raffle = await this.findOne(id);

    if (raffle.sellerId !== userId) {
      throw new ForbiddenException('Solo el vendedor puede modificar la rifa');
    }

    const soldTickets = await this.prisma.ticket.count({
      where: { raffleId: id, estado: 'PAGADO' },
    });

    if (soldTickets > 0) {
      throw new BadRequestException(
        'No se puede modificar una rifa con tickets vendidos',
      );
    }

    return this.prisma.raffle.update({
      where: { id },
      data: {
        titulo: input.titulo,
        descripcion: input.descripcion,
        fechaLimiteSorteo: input.fechaLimite
          ? new Date(input.fechaLimite)
          : undefined,
      },
      include: { product: true, seller: true },
    });
  }

  async cancel(id: string, userId: string) {
    const raffle = await this.findOne(id);

    if (raffle.sellerId !== userId) {
      throw new ForbiddenException('Solo el vendedor puede cancelar la rifa');
    }

    if (raffle.estado !== 'ACTIVA') {
      throw new BadRequestException('Solo se pueden cancelar rifas activas');
    }

    const cancelledRaffle = await this.prisma.raffle.update({
      where: { id },
      data: { estado: 'CANCELADA' },
      include: {
        product: true,
        seller: true,
        tickets: { where: { estado: 'PAGADO' }, include: { buyer: true } },
      },
    });

    // Emit cancellation event for cross-cutting concerns
    this.eventEmitter.emit(
      RaffleEvents.CANCELLED,
      new RaffleCancelledEvent(
        id,
        userId,
        'Cancelada por el vendedor',
        cancelledRaffle.tickets?.length || 0,
      ),
    );

    // Notify all buyers who purchased tickets (non-blocking)
    this.notifyCancellation(cancelledRaffle).catch((err) => {
      this.logger.error(
        `Failed to send cancellation notifications: ${err.message}`,
      );
    });

    return cancelledRaffle;
  }

  private async notifyCancellation(raffle: any) {
    const uniqueBuyers = new Map<string, { id: string; email: string }>();
    for (const ticket of raffle.tickets || []) {
      if (ticket.buyer && !uniqueBuyers.has(ticket.buyerId)) {
        uniqueBuyers.set(ticket.buyerId, ticket.buyer);
      }
    }

    const notifications: Promise<any>[] = [];
    for (const [buyerId, buyer] of uniqueBuyers) {
      notifications.push(
        this.notifications.sendRaffleCancelledNotification(buyer.email, {
          raffleName: raffle.titulo,
          reason: 'Cancelada por el vendedor',
        }),
      );
      notifications.push(
        this.notifications.create(
          buyerId,
          'INFO',
          'Rifa cancelada',
          `La rifa "${raffle.titulo}" ha sido cancelada. Recibirás un reembolso.`,
        ),
      );
    }

    notifications.push(
      this.activityService.logRaffleCancelled(
        raffle.sellerId,
        raffle.id,
        raffle.titulo,
      ),
    );

    await Promise.all(notifications);
  }

  async markAsShipped(
    raffleId: string,
    userId: string,
    trackingNumber?: string,
  ) {
    const raffle = await this.findOne(raffleId);

    if (raffle.sellerId !== userId) {
      throw new ForbiddenException(
        'Solo el vendedor puede marcar como enviado',
      );
    }

    if (raffle.estado !== 'SORTEADA') {
      throw new BadRequestException('La rifa debe estar sorteada');
    }

    if (raffle.deliveryStatus !== 'PENDING') {
      throw new BadRequestException('El envío ya ha sido marcado o completado');
    }

    const updatedRaffle = await this.prisma.raffle.update({
      where: { id: raffleId },
      data: {
        deliveryStatus: 'SHIPPED',
        trackingNumber,
        shippedAt: new Date(),
      },
      include: { product: true, seller: true, winner: true },
    });

    // Notify winner about shipment (non-blocking)
    if (updatedRaffle.winner) {
      this.notifyShipment(updatedRaffle).catch((err) => {
        this.logger.error(
          `Failed to send shipment notifications: ${err.message}`,
        );
      });
    }

    return updatedRaffle;
  }

  private async notifyShipment(raffle: any) {
    const winner = raffle.winner;
    if (!winner) return;

    await Promise.all([
      this.notifications.create(
        winner.id,
        'INFO',
        '¡Tu premio fue enviado!',
        `El vendedor ha enviado el premio de "${raffle.titulo}".${raffle.trackingNumber ? ` Número de seguimiento: ${raffle.trackingNumber}` : ''}`,
      ),
      this.activityService.logDeliveryShipped(
        raffle.sellerId,
        raffle.id,
        raffle.trackingNumber,
      ),
    ]);
  }

  async confirmDelivery(raffleId: string, userId: string) {
    const raffle = await this.findOne(raffleId);

    if (raffle.winnerId !== userId) {
      throw new ForbiddenException(
        'Solo el ganador puede confirmar la entrega',
      );
    }

    if (raffle.deliveryStatus === 'CONFIRMED') {
      throw new BadRequestException('La entrega ya ha sido confirmada');
    }

    // 1. Release Funds (Placeholder)
    // TODO: Call MpService.releaseFunds(raffle.sellerId, raffleAmount)
    const fundsReleased = true; // Placeholder

    // 2. Increment Seller Reputation
    await this.prisma.userReputation.upsert({
      where: { userId: raffle.sellerId },
      create: {
        userId: raffle.sellerId,
        totalVentasCompletadas: 1,
      },
      update: {
        totalVentasCompletadas: { increment: 1 },
      },
    });

    // 3. Update Raffle Status
    const updatedRaffle = await this.prisma.raffle.update({
      where: { id: raffleId },
      data: {
        deliveryStatus: 'CONFIRMED',
        confirmedAt: new Date(),
        paymentReleasedAt: fundsReleased ? new Date() : null,
        estado: 'FINALIZADA', // Close the loop
      },
      include: { product: true, seller: true, winner: true },
    });

    // Emit delivery confirmed event for cross-cutting concerns
    this.eventEmitter.emit(
      RaffleEvents.DELIVERY_CONFIRMED,
      new DeliveryConfirmedEvent(raffleId, userId, raffle.sellerId),
    );

    // Notify seller about delivery confirmation (non-blocking)
    this.notifyDeliveryConfirmed(updatedRaffle).catch((err) => {
      this.logger.error(
        `Failed to send delivery confirmation notifications: ${err.message}`,
      );
    });

    return updatedRaffle;
  }

  private async notifyDeliveryConfirmed(raffle: any) {
    const seller = raffle.seller;
    if (!seller) return;

    await Promise.all([
      this.notifications.create(
        seller.id,
        'INFO',
        '¡Entrega confirmada!',
        `El ganador ha confirmado la recepción del premio de "${raffle.titulo}". Los fondos serán liberados pronto.`,
      ),
      this.activityService.logDeliveryConfirmed(raffle.winnerId, raffle.id),
    ]);
  }

  async relaunchWithSuggestedPrice(
    sellerId: string,
    input: RelaunchRaffleInput,
  ) {
    // 1. Verify the original raffle belongs to this seller
    const originalRaffle = await this.prisma.raffle.findUnique({
      where: { id: input.originalRaffleId },
      include: { product: true },
    });

    if (!originalRaffle) {
      throw new NotFoundException('Rifa no encontrada');
    }

    if (originalRaffle.sellerId !== sellerId) {
      throw new ForbiddenException('Solo puedes relanzar tus propias rifas');
    }

    if (originalRaffle.estado !== 'CANCELADA') {
      throw new BadRequestException('Solo se pueden relanzar rifas canceladas');
    }

    // 2. Get the price reduction suggestion
    const priceReduction = await this.prisma.priceReduction.findUnique({
      where: { id: input.priceReductionId },
    });

    if (!priceReduction) {
      throw new NotFoundException('Sugerencia de precio no encontrada');
    }

    if (priceReduction.raffleId !== input.originalRaffleId) {
      throw new BadRequestException(
        'La sugerencia de precio no corresponde a esta rifa',
      );
    }

    // 3. Calculate new price (use custom or suggested)
    const newPrice =
      input.customPrice || Number(priceReduction.precioSugerido);

    if (newPrice <= 0) {
      throw new BadRequestException('El precio debe ser mayor a 0');
    }

    // 4. Calculate deadline (default 30 days)
    const daysUntil = input.daysUntilDraw || 30;
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + daysUntil);

    // 5. Create new raffle with same product data
    const newRaffle = await this.prisma.raffle.create({
      data: {
        titulo: `${originalRaffle.titulo} (Relanzamiento)`,
        descripcion: originalRaffle.descripcion,
        sellerId: sellerId,
        totalTickets: originalRaffle.totalTickets,
        precioPorTicket: newPrice,
        fechaLimiteSorteo: fechaLimite,
        estado: 'ACTIVA',
        // Create product copy
        product: {
          create: {
            nombre: originalRaffle.product!.nombre,
            descripcionDetallada:
              originalRaffle.product!.descripcionDetallada,
            categoria: originalRaffle.product!.categoria,
            condicion: originalRaffle.product!.condicion,
            imagenes: originalRaffle.product!.imagenes,
            especificacionesTecnicas:
              originalRaffle.product!.especificacionesTecnicas as any,
          },
        },
      },
      include: { product: true },
    });

    // 6. Mark price reduction as accepted
    await this.prisma.priceReduction.update({
      where: { id: input.priceReductionId },
      data: {
        aceptada: true,
        fechaRespuesta: new Date(),
      },
    });

    // 7. Log activity
    this.activityService
      .logRaffleCreated(sellerId, newRaffle.id, newRaffle.titulo)
      .catch((err) => {
        this.logger.error(`Failed to log raffle relaunch: ${err.message}`);
      });

    // 8. Invalidate cache
    this.invalidateRaffleCache().catch((err) => {
      this.logger.warn(`Cache invalidation failed: ${err.message}`);
    });

    return newRaffle;
  }

  async selectWinner(raffleId: string) {
    const raffle = await this.findOne(raffleId);

    const paidTickets = await this.prisma.ticket.findMany({
      where: { raffleId, estado: 'PAGADO' },
      include: { buyer: true },
    });

    if (paidTickets.length === 0) {
      throw new BadRequestException('No hay tickets pagados para sortear');
    }

    const randomIndex = Math.floor(Math.random() * paidTickets.length);
    const winningTicket = paidTickets[randomIndex];

    await this.prisma.drawResult.create({
      data: {
        raffleId,
        winningTicketId: winningTicket.id,
        winnerId: winningTicket.buyerId,
        method: 'RANDOM_INDEX',
        totalParticipants: paidTickets.length,
      },
    });

    const updatedRaffle = await this.prisma.raffle.update({
      where: { id: raffleId },
      data: {
        estado: 'SORTEADA',
        winnerId: winningTicket.buyerId,
        fechaSorteoReal: new Date(),
      },
      include: { product: true, seller: true, winner: true },
    });

    // Emit raffle drawn event for cross-cutting concerns
    this.eventEmitter.emit(
      RaffleEvents.DRAWN,
      new RaffleDrawnEvent(
        raffleId,
        winningTicket.buyerId,
        winningTicket.numeroTicket,
        raffle.sellerId,
      ),
    );

    // Notify winner and participants (non-blocking)
    this.notifyDrawResult(updatedRaffle, paidTickets, winningTicket).catch(
      (err) => {
        this.logger.error(
          `Failed to send draw result notifications: ${err.message}`,
        );
      },
    );

    return updatedRaffle;
  }

  private async notifyDrawResult(
    raffle: any,
    paidTickets: any[],
    winningTicket: any,
  ) {
    const notifications: Promise<any>[] = [];

    // Notify winner via email and in-app
    if (raffle.winner) {
      notifications.push(
        this.notifications.sendWinnerNotification(raffle.winner.email, {
          raffleName: raffle.titulo,
          productName: raffle.product?.nombre || raffle.titulo,
          sellerEmail: raffle.seller?.email || '',
        }),
      );
      notifications.push(
        this.notifications.create(
          raffle.winnerId,
          'WIN',
          '🎉 ¡GANASTE!',
          `¡Felicitaciones! Has ganado la rifa "${raffle.titulo}". El vendedor se pondrá en contacto contigo pronto.`,
        ),
      );
    }

    // Notify seller to contact winner
    if (raffle.seller && raffle.winner) {
      notifications.push(
        this.notifications.sendSellerMustContactWinner(raffle.seller.email, {
          raffleName: raffle.titulo,
          winnerEmail: raffle.winner.email,
        }),
      );
      notifications.push(
        this.notifications.create(
          raffle.sellerId,
          'INFO',
          '¡Tu rifa tiene un ganador!',
          `La rifa "${raffle.titulo}" ha sido sorteada. Tienes 48hs para contactar al ganador.`,
        ),
      );
    }

    // Notify non-winners
    const uniqueNonWinners = new Map<
      string,
      { id: string; email: string; nombre: string }
    >();
    for (const ticket of paidTickets) {
      if (
        ticket.buyerId !== winningTicket.buyerId &&
        ticket.buyer &&
        !uniqueNonWinners.has(ticket.buyerId)
      ) {
        uniqueNonWinners.set(ticket.buyerId, ticket.buyer);
      }
    }

    for (const [buyerId, buyer] of uniqueNonWinners) {
      notifications.push(
        this.notifications.sendRaffleParticipantNotification(buyer.email, {
          raffleName: raffle.titulo,
          winnerName: raffle.winner?.nombre || 'Un participante',
        }),
      );
      notifications.push(
        this.notifications.create(
          buyerId,
          'INFO',
          'Resultado del sorteo',
          `La rifa "${raffle.titulo}" ya tiene un ganador. ¡Gracias por participar!`,
        ),
      );
    }

    // Log activity
    notifications.push(
      this.activityService.logRaffleDrawn(
        raffle.sellerId,
        raffle.id,
        raffle.winnerId,
      ),
    );

    await Promise.all(notifications);
  }

  async suggestPriceReduction(raffleId: string) {
    const raffle = await this.findOne(raffleId);

    const soldTickets = await this.prisma.ticket.count({
      where: { raffleId, estado: 'PAGADO' },
    });

    const porcentajeVendido = soldTickets / raffle.totalTickets;
    const porcentajeNoVendido = 1 - porcentajeVendido;

    const factorReduccion = porcentajeNoVendido * 0.5;
    const precioActual = Number(raffle.precioPorTicket);
    const precioSugerido =
      Math.round(precioActual * (1 - factorReduccion) * 100) / 100;
    const porcentajeReduccion =
      Math.round(((precioActual - precioSugerido) / precioActual) * 100 * 100) /
      100;

    return this.prisma.priceReduction.create({
      data: {
        raffleId,
        precioAnterior: precioActual,
        precioSugerido,
        porcentajeReduccion,
        ticketsVendidosAlMomento: soldTickets,
      },
    });
  }

  calculateCommissions(totalAmount: number) {
    const platformFee = totalAmount * PLATFORM_FEE_RATE;
    const stripeFee = totalAmount * STRIPE_FEE_RATE + STRIPE_FIXED_FEE;
    const totalFees = platformFee + stripeFee;
    const netAmount = totalAmount - totalFees;

    return { platformFee, stripeFee, totalFees, netAmount };
  }

  getTicketStats(raffle: any) {
    const soldTickets =
      raffle.tickets?.filter((t: any) => t.estado === 'PAGADO').length || 0;
    return {
      ticketsVendidos: soldTickets,
      ticketsDisponibles: raffle.totalTickets - soldTickets,
      maxTicketsPorUsuario: Math.floor(raffle.totalTickets * 0.5),
      precioTotal: Number(raffle.precioPorTicket) * raffle.totalTickets,
    };
  }

  async extendRaffleDeadline(
    raffleId: string,
    userId: string,
    newDeadline: Date,
  ) {
    const raffle = await this.findOne(raffleId);

    if (raffle.sellerId !== userId) {
      throw new ForbiddenException('Solo el vendedor puede extender el plazo');
    }

    if (raffle.estado !== 'ACTIVA') {
      throw new BadRequestException(
        'Solo se puede extender el plazo de rifas activas',
      );
    }

    if (newDeadline <= new Date()) {
      throw new BadRequestException('La nueva fecha debe ser en el futuro');
    }

    if (newDeadline <= raffle.fechaLimiteSorteo) {
      throw new BadRequestException(
        'La nueva fecha debe ser posterior a la fecha límite actual',
      );
    }

    const updatedRaffle = await this.prisma.raffle.update({
      where: { id: raffleId },
      data: { fechaLimiteSorteo: newDeadline },
      include: {
        product: true,
        seller: true,
        tickets: { where: { estado: 'PAGADO' }, include: { buyer: true } },
      },
    });

    // Notify ticket holders about deadline extension (non-blocking)
    this.notifyDeadlineExtension(updatedRaffle, newDeadline).catch((err) => {
      this.logger.error(
        `Failed to send deadline extension notifications: ${err.message}`,
      );
    });

    return updatedRaffle;
  }

  private async notifyDeadlineExtension(raffle: any, newDeadline: Date) {
    const uniqueBuyers = new Map<string, { id: string; email: string }>();
    for (const ticket of raffle.tickets || []) {
      if (ticket.buyer && !uniqueBuyers.has(ticket.buyerId)) {
        uniqueBuyers.set(ticket.buyerId, ticket.buyer);
      }
    }

    const notifications: Promise<any>[] = [];
    for (const [buyerId] of uniqueBuyers) {
      notifications.push(
        this.notifications.create(
          buyerId,
          'INFO',
          'Plazo extendido',
          `La rifa "${raffle.titulo}" ha extendido su fecha límite hasta el ${newDeadline.toLocaleDateString()}.`,
        ),
      );
    }

    // Log activity
    notifications.push(
      this.activityService.logRaffleDeadlineExtended(
        raffle.sellerId,
        raffle.id,
        newDeadline,
      ),
    );

    await Promise.all(notifications);
  }

  async rejectRaffleWinner(raffleId: string, adminId: string, reason: string) {
    const raffle = await this.findOne(raffleId);

    if (raffle.estado !== 'SORTEADA') {
      throw new BadRequestException(
        'Solo se puede rechazar el ganador de rifas sorteadas',
      );
    }

    if (!raffle.winnerId) {
      throw new BadRequestException('Esta rifa no tiene un ganador asignado');
    }

    const previousWinnerId = raffle.winnerId;

    // Reset raffle to active state for re-draw
    const updatedRaffle = await this.prisma.raffle.update({
      where: { id: raffleId },
      data: {
        estado: 'ACTIVA',
        winnerId: null,
        fechaSorteoReal: null,
      },
      include: { product: true, seller: true, winner: true },
    });

    // Log the rejection and notify affected parties (non-blocking)
    this.notifyWinnerRejection(raffle, previousWinnerId, adminId, reason).catch(
      (err) => {
        this.logger.error(
          `Failed to send winner rejection notifications: ${err.message}`,
        );
      },
    );

    return updatedRaffle;
  }

  private async notifyWinnerRejection(
    raffle: any,
    previousWinnerId: string,
    adminId: string,
    reason: string,
  ) {
    const notifications: Promise<any>[] = [];

    // Notify previous winner
    notifications.push(
      this.notifications.create(
        previousWinnerId,
        'WARNING',
        'Resultado del sorteo invalidado',
        `Tu premio de la rifa "${raffle.titulo}" ha sido invalidado. Motivo: ${reason}`,
      ),
    );

    // Notify seller
    notifications.push(
      this.notifications.create(
        raffle.sellerId,
        'WARNING',
        'Ganador invalidado por administración',
        `El ganador de tu rifa "${raffle.titulo}" ha sido invalidado. La rifa está disponible para un nuevo sorteo.`,
      ),
    );

    // Log activity
    notifications.push(
      this.activityService.logRaffleWinnerRejected(
        adminId,
        raffle.id,
        previousWinnerId,
        reason,
      ),
    );

    await Promise.all(notifications);
  }

  // ==================== SELLER DASHBOARD METHODS ====================

  async incrementViewCount(raffleId: string) {
    return this.prisma.raffle.update({
      where: { id: raffleId },
      data: { viewCount: { increment: 1 } },
    });
  }

  async getSellerDashboardStats(sellerId: string) {
    // Get all seller's raffles with tickets
    const raffles = await this.prisma.raffle.findMany({
      where: { sellerId },
      include: { tickets: { where: { estado: 'PAGADO' } } },
    });

    // Calculate totals
    let totalRevenue = 0;
    let totalTicketsSold = 0;
    let totalViews = 0;
    let activeRaffles = 0;
    let completedRaffles = 0;

    for (const raffle of raffles) {
      const ticketsSold = raffle.tickets.length;
      totalTicketsSold += ticketsSold;
      totalViews += raffle.viewCount;

      for (const ticket of raffle.tickets) {
        totalRevenue += Number(ticket.precioPagado);
      }

      if (raffle.estado === 'ACTIVA') activeRaffles++;
      if (['SORTEADA', 'FINALIZADA', 'EN_ENTREGA'].includes(raffle.estado))
        completedRaffles++;
    }

    // Calculate conversion rate (tickets sold / views)
    const conversionRate =
      totalViews > 0 ? (totalTicketsSold / totalViews) * 100 : 0;

    // Get monthly revenue for the last 12 months
    const monthlyRevenue = await this.getMonthlyRevenue(sellerId);

    return {
      totalRevenue,
      totalTicketsSold,
      activeRaffles,
      completedRaffles,
      totalViews,
      conversionRate: Math.round(conversionRate * 100) / 100,
      monthlyRevenue,
    };
  }

  private async getMonthlyRevenue(sellerId: string) {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    // Get all paid tickets for seller's raffles in the last 12 months
    const tickets = await this.prisma.ticket.findMany({
      where: {
        raffle: { sellerId },
        estado: 'PAGADO',
        fechaCompra: { gte: twelveMonthsAgo },
      },
      include: { raffle: true },
    });

    // Group by month
    const monthlyData = new Map<
      string,
      { revenue: number; ticketsSold: number; rafflesCompleted: Set<string> }
    >();

    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      monthlyData.set(key, {
        revenue: 0,
        ticketsSold: 0,
        rafflesCompleted: new Set(),
      });
    }

    for (const ticket of tickets) {
      const date = new Date(ticket.fechaCompra);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      const data = monthlyData.get(key);
      if (data) {
        data.revenue += Number(ticket.precioPagado);
        data.ticketsSold += 1;
        if (['SORTEADA', 'FINALIZADA'].includes(ticket.raffle.estado)) {
          data.rafflesCompleted.add(ticket.raffleId);
        }
      }
    }

    // Convert to array
    return Array.from(monthlyData.entries())
      .map(([key, data]) => {
        const [year, month] = key.split('-').map(Number);
        return {
          year,
          month,
          revenue: Math.round(data.revenue * 100) / 100,
          ticketsSold: data.ticketsSold,
          rafflesCompleted: data.rafflesCompleted.size,
        };
      })
      .reverse(); // Oldest first
  }

  async bulkCancelRaffles(sellerId: string, raffleIds: string[]) {
    const results = {
      successCount: 0,
      failedCount: 0,
      failedIds: [] as string[],
      errors: [] as string[],
    };

    for (const raffleId of raffleIds) {
      try {
        await this.cancel(raffleId, sellerId);
        results.successCount++;
      } catch (error: any) {
        results.failedCount++;
        results.failedIds.push(raffleId);
        results.errors.push(`${raffleId}: ${error.message}`);
      }
    }

    return results;
  }

  async bulkExtendRaffles(
    sellerId: string,
    raffleIds: string[],
    newDeadline: Date,
  ) {
    const results = {
      successCount: 0,
      failedCount: 0,
      failedIds: [] as string[],
      errors: [] as string[],
    };

    for (const raffleId of raffleIds) {
      try {
        await this.extendRaffleDeadline(raffleId, sellerId, newDeadline);
        results.successCount++;
      } catch (error: any) {
        results.failedCount++;
        results.failedIds.push(raffleId);
        results.errors.push(`${raffleId}: ${error.message}`);
      }
    }

    return results;
  }

  // ==================== BUYER EXPERIENCE METHODS ====================

  async getBuyerStats(userId: string) {
    // Get all user's tickets
    const tickets = await this.prisma.ticket.findMany({
      where: { buyerId: userId },
      include: { raffle: true },
    });

    // Get raffles won
    const rafflesWon = await this.prisma.raffle.count({
      where: { winnerId: userId },
    });

    // Get favorites count
    const favoritesCount = await this.prisma.favorite.count({
      where: { userId },
    });

    // Calculate stats
    const paidTickets = tickets.filter((t) => t.estado === 'PAGADO');
    const totalTicketsPurchased = paidTickets.length;
    const totalSpent = paidTickets.reduce(
      (sum, t) => sum + Number(t.precioPagado),
      0,
    );

    // Count unique raffles participated
    const uniqueRaffles = new Set(paidTickets.map((t) => t.raffleId)).size;
    const winRate = uniqueRaffles > 0 ? (rafflesWon / uniqueRaffles) * 100 : 0;

    // Active tickets (in ACTIVA raffles)
    const activeTickets = paidTickets.filter(
      (t) => t.raffle.estado === 'ACTIVA',
    ).length;

    return {
      totalTicketsPurchased,
      totalRafflesWon: rafflesWon,
      winRate: Math.round(winRate * 100) / 100,
      totalSpent: Math.round(totalSpent * 100) / 100,
      activeTickets,
      favoritesCount,
    };
  }

  async getRecommendedRaffles(userId: string, limit = 10) {
    // Get user's favorite categories (from their purchased tickets and favorites)
    const userTickets = await this.prisma.ticket.findMany({
      where: { buyerId: userId, estado: 'PAGADO' },
      include: { raffle: { include: { product: true } } },
      take: 50,
    });

    const userFavorites = await this.prisma.favorite.findMany({
      where: { userId },
      include: { raffle: { include: { product: true } } },
      take: 50,
    });

    // Extract categories from user's history
    const categoryCount = new Map<string, number>();
    for (const ticket of userTickets) {
      const cat = ticket.raffle.product?.categoria;
      if (cat) categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
    }
    for (const fav of userFavorites) {
      const cat = fav.raffle.product?.categoria;
      if (cat) categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
    }

    // Get top categories
    const topCategories = Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);

    // Get raffles user hasn't participated in, prioritizing top categories
    const participatedRaffleIds = new Set(userTickets.map((t) => t.raffleId));
    const favoritedRaffleIds = new Set(userFavorites.map((f) => f.raffleId));

    const recommendations = await this.prisma.raffle.findMany({
      where: {
        estado: 'ACTIVA',
        isHidden: false,
        sellerId: { not: userId }, // Don't recommend own raffles
        id: { notIn: Array.from(participatedRaffleIds) },
        ...(topCategories.length > 0 && {
          product: { categoria: { in: topCategories } },
        }),
      },
      include: {
        product: true,
        seller: true,
        _count: { select: { tickets: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // If not enough from top categories, fill with popular raffles
    if (recommendations.length < limit) {
      const additionalRaffles = await this.prisma.raffle.findMany({
        where: {
          estado: 'ACTIVA',
          isHidden: false,
          sellerId: { not: userId },
          id: {
            notIn: [
              ...Array.from(participatedRaffleIds),
              ...recommendations.map((r) => r.id),
            ],
          },
        },
        include: {
          product: true,
          seller: true,
          _count: { select: { tickets: true } },
        },
        orderBy: { viewCount: 'desc' },
        take: limit - recommendations.length,
      });
      recommendations.push(...additionalRaffles);
    }

    return recommendations;
  }

  async getFavoritesEndingSoon(userId: string, hoursThreshold = 48) {
    const thresholdDate = new Date(
      Date.now() + hoursThreshold * 60 * 60 * 1000,
    );

    return this.prisma.raffle.findMany({
      where: {
        favorites: { some: { userId } },
        estado: 'ACTIVA',
        fechaLimiteSorteo: { lte: thresholdDate },
      },
      include: {
        product: true,
        seller: true,
        _count: { select: { tickets: true } },
      },
      orderBy: { fechaLimiteSorteo: 'asc' },
    });
  }

  // ==================== PRICE ALERTS ====================

  async updatePrice(raffleId: string, sellerId: string, newPrice: number) {
    const raffle = await this.findOne(raffleId);

    if (raffle.sellerId !== sellerId) {
      throw new ForbiddenException('Solo el vendedor puede cambiar el precio');
    }

    if (raffle.estado !== 'ACTIVA') {
      throw new BadRequestException(
        'Solo se puede cambiar el precio de rifas activas',
      );
    }

    if (newPrice <= 0) {
      throw new BadRequestException('El precio debe ser mayor a 0');
    }

    const oldPrice = Number(raffle.precioPorTicket);

    // Record price history (for both increases and decreases)
    if (oldPrice !== newPrice) {
      await this.prisma.priceHistory.create({
        data: {
          raffleId,
          previousPrice: oldPrice,
          newPrice,
        },
      });
    }

    // If price increased or stayed the same, just update
    if (newPrice >= oldPrice) {
      return this.prisma.raffle.update({
        where: { id: raffleId },
        data: { precioPorTicket: newPrice },
        include: { product: true, seller: true },
      });
    }

    // Price decreased - update and notify favorited users
    const updatedRaffle = await this.prisma.raffle.update({
      where: { id: raffleId },
      data: {
        precioPorTicket: newPrice,
        lastPriceDropAt: new Date(),
      },
      include: { product: true, seller: true },
    });

    // Notify users who favorited this raffle (async, non-blocking)
    this.notifyPriceDrop(raffleId, raffle.titulo, oldPrice, newPrice).catch(
      (err) => {
        this.logger.error(
          `Failed to send price drop notifications: ${err.message}`,
        );
      },
    );

    // Invalidate cache
    this.invalidateRaffleCache(raffleId).catch((err) => {
      this.logger.warn(`Cache invalidation failed: ${err.message}`);
    });

    return updatedRaffle;
  }

  async getPriceHistory(raffleId: string) {
    return this.prisma.priceHistory.findMany({
      where: { raffleId },
      orderBy: { changedAt: 'asc' },
    });
  }

  private async notifyPriceDrop(
    raffleId: string,
    raffleName: string,
    oldPrice: number,
    newPrice: number,
  ) {
    // Get all users who favorited this raffle
    const favorites = await this.prisma.favorite.findMany({
      where: { raffleId },
      include: { user: true },
    });

    if (favorites.length === 0) {
      this.logger.debug(`No favorites to notify for raffle ${raffleId}`);
      return;
    }

    const dropPercent = Math.round(((oldPrice - newPrice) / oldPrice) * 100);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const raffleUrl = `${frontendUrl}/raffle/${raffleId}`;

    const notifications: Promise<any>[] = [];

    for (const fav of favorites) {
      // In-app notification
      notifications.push(
        this.notifications.create(
          fav.userId,
          'PRICE_DROP',
          `¡Precio reducido ${dropPercent}%!`,
          `"${raffleName}" ahora cuesta $${newPrice} (era $${oldPrice})`,
        ),
      );

      // Email notification
      notifications.push(
        this.notifications.sendPriceDropAlert(fav.user.email, {
          raffleName,
          oldPrice,
          newPrice,
          dropPercent,
          raffleUrl,
        }),
      );
    }

    await Promise.all(notifications);
    this.logger.log(
      `Sent price drop notifications to ${favorites.length} users for raffle ${raffleId}`,
    );
  }
}

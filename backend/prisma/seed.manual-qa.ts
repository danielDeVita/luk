import {
  PrismaClient,
  UserRole,
  KycStatus,
  MpConnectStatus,
  RaffleStatus,
  DeliveryStatus,
  ProductCondition,
  TicketStatus,
  DisputeType,
  DisputeStatus,
  PayoutStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const QA_PREFIX = '[QA]';
const DEFAULT_PASSWORD = 'Password123!';
const DEFAULT_ADMIN_PASSWORD = 'Admin123!';

const USERS = {
  seller: 'qa.seller@test.com',
  buyer: 'qa.buyer@test.com',
  other: 'qa.other@test.com',
  admin: 'qa.admin@test.com',
};

const IDS = {
  sellerAddress: 'qa_addr_seller_default',
  buyerAddress: 'qa_addr_buyer_default',
  otherAddress: 'qa_addr_other_default',
  raffleActive: 'qa_raffle_active_search',
  raffleHidden: 'qa_raffle_hidden',
  raffleDeleted: 'qa_raffle_deleted',
  raffleCompletedNoDraw: 'qa_raffle_completed_no_draw',
  raffleSorteadaPending: 'qa_raffle_sorteada_pending_shipping',
  raffleShipped: 'qa_raffle_shipped_waiting_confirm',
  raffleFinalizedPayout: 'qa_raffle_finalized_with_payout',
  raffleCancelledRelaunch: 'qa_raffle_cancelled_relaunch',
  raffleExpiredLowSale: 'qa_raffle_expired_low_sale',
  raffleDisputeOpen: 'qa_raffle_dispute_open',
  raffleDisputeMediation: 'qa_raffle_dispute_mediation',
  raffleDisputeOld: 'qa_raffle_dispute_old',
  priceReduction: 'qa_price_reduction_1',
};

const QA_CATEGORIES = [
  {
    nombre: 'Electronica',
    descripcion: 'Celulares, computadoras, gadgets',
    icono: 'laptop',
    orden: 1,
  },
  {
    nombre: 'Moda',
    descripcion: 'Ropa, zapatillas, accesorios',
    icono: 'shirt',
    orden: 2,
  },
  {
    nombre: 'Hogar',
    descripcion: 'Electrodomésticos, muebles, decoración',
    icono: 'home',
    orden: 3,
  },
  {
    nombre: 'Deportes',
    descripcion: 'Equipamiento deportivo, bicicletas',
    icono: 'dumbbell',
    orden: 4,
  },
  {
    nombre: 'Vehiculos',
    descripcion: 'Autos, motos, accesorios',
    icono: 'car',
    orden: 5,
  },
  {
    nombre: 'Entretenimiento',
    descripcion: 'Consolas, juegos, instrumentos',
    icono: 'gamepad',
    orden: 6,
  },
  {
    nombre: 'Otros',
    descripcion: 'Todo lo demás',
    icono: 'box',
    orden: 99,
  },
];

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function daysAgo(days: number): Date {
  return daysFromNow(-days);
}

function ticketId(raffleId: string, n: number): string {
  return `qa_ticket_${raffleId}_${n}`;
}

function drawId(raffleId: string): string {
  return `qa_draw_${raffleId}`;
}

function payoutId(raffleId: string): string {
  return `qa_payout_${raffleId}`;
}

function disputeId(raffleId: string): string {
  return `qa_dispute_${raffleId}`;
}

async function upsertUser(params: {
  email: string;
  nombre: string;
  apellido: string;
  passwordHash: string;
  role?: UserRole;
  kycStatus?: KycStatus;
  mpConnectStatus?: MpConnectStatus;
  mpUserId?: string | null;
  mpAccessToken?: string | null;
}) {
  const {
    email,
    nombre,
    apellido,
    passwordHash,
    role = UserRole.USER,
    kycStatus = KycStatus.NOT_SUBMITTED,
    mpConnectStatus = MpConnectStatus.NOT_CONNECTED,
    mpUserId = null,
    mpAccessToken = null,
  } = params;

  return prisma.user.upsert({
    where: { email },
    update: {
      nombre,
      apellido,
      passwordHash,
      role,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date(),
      termsVersion: '1.0',
      kycStatus,
      kycVerifiedAt: kycStatus === KycStatus.VERIFIED ? new Date() : null,
      mpConnectStatus,
      mpUserId,
      mpAccessToken,
      isDeleted: false,
      deletedAt: null,
    },
    create: {
      email,
      nombre,
      apellido,
      passwordHash,
      role,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date(),
      termsVersion: '1.0',
      kycStatus,
      kycVerifiedAt: kycStatus === KycStatus.VERIFIED ? new Date() : null,
      mpConnectStatus,
      mpUserId,
      mpAccessToken,
    },
  });
}

async function upsertAddress(params: {
  id: string;
  userId: string;
  label: string;
  recipientName: string;
  street: string;
  number: string;
  city: string;
  province: string;
  postalCode: string;
  isDefault: boolean;
}) {
  const {
    id,
    userId,
    label,
    recipientName,
    street,
    number,
    city,
    province,
    postalCode,
    isDefault,
  } = params;

  await prisma.shippingAddress.upsert({
    where: { id },
    update: {
      userId,
      label,
      recipientName,
      street,
      number,
      city,
      province,
      postalCode,
      country: 'Argentina',
      phone: '+54 11 5555-0000',
      isDefault,
    },
    create: {
      id,
      userId,
      label,
      recipientName,
      street,
      number,
      city,
      province,
      postalCode,
      country: 'Argentina',
      phone: '+54 11 5555-0000',
      isDefault,
    },
  });
}

async function upsertRaffle(params: {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  totalTickets: number;
  price: number;
  deadline: Date;
  status: RaffleStatus;
  deliveryStatus?: DeliveryStatus;
  winnerId?: string | null;
  drawDate?: Date | null;
  trackingNumber?: string | null;
  shippedAt?: Date | null;
  confirmedAt?: Date | null;
  paymentReleasedAt?: Date | null;
  isHidden?: boolean;
  isDeleted?: boolean;
}) {
  const {
    id,
    sellerId,
    title,
    description,
    totalTickets,
    price,
    deadline,
    status,
    deliveryStatus = DeliveryStatus.PENDING,
    winnerId = null,
    drawDate = null,
    trackingNumber = null,
    shippedAt = null,
    confirmedAt = null,
    paymentReleasedAt = null,
    isHidden = false,
    isDeleted = false,
  } = params;

  await prisma.raffle.upsert({
    where: { id },
    update: {
      titulo: title,
      descripcion: description,
      sellerId,
      totalTickets,
      precioPorTicket: price,
      fechaLimiteSorteo: deadline,
      estado: status,
      deliveryStatus,
      winnerId,
      fechaSorteoReal: drawDate,
      trackingNumber,
      shippedAt,
      confirmedAt,
      paymentReleasedAt,
      isHidden,
      isDeleted,
      deletedAt: isDeleted ? new Date() : null,
      hiddenReason: isHidden ? 'QA hidden scenario' : null,
    },
    create: {
      id,
      titulo: title,
      descripcion: description,
      sellerId,
      totalTickets,
      precioPorTicket: price,
      fechaLimiteSorteo: deadline,
      estado: status,
      deliveryStatus,
      winnerId,
      fechaSorteoReal: drawDate,
      trackingNumber,
      shippedAt,
      confirmedAt,
      paymentReleasedAt,
      isHidden,
      isDeleted,
      deletedAt: isDeleted ? new Date() : null,
      hiddenReason: isHidden ? 'QA hidden scenario' : null,
    },
  });

  await prisma.product.upsert({
    where: { raffleId: id },
    update: {
      nombre: `${title} - Producto`,
      descripcionDetallada: `Producto de prueba para ${title}.`,
      categoria: 'Electronica',
      condicion: ProductCondition.NUEVO,
      imagenes: ['https://picsum.photos/seed/manual-qa/800/600'],
      especificacionesTecnicas: {
        source: 'manual-qa-seed',
      },
    },
    create: {
      id: `qa_product_${id}`,
      raffleId: id,
      nombre: `${title} - Producto`,
      descripcionDetallada: `Producto de prueba para ${title}.`,
      categoria: 'Electronica',
      condicion: ProductCondition.NUEVO,
      imagenes: ['https://picsum.photos/seed/manual-qa/800/600'],
      especificacionesTecnicas: {
        source: 'manual-qa-seed',
      },
    },
  });
}

async function upsertTicket(params: {
  raffleId: string;
  number: number;
  buyerId: string;
  status: TicketStatus;
  price: number;
  mpPaymentId?: string | null;
  purchasedAt?: Date;
}) {
  const {
    raffleId,
    number,
    buyerId,
    status,
    price,
    mpPaymentId = null,
    purchasedAt = new Date(),
  } = params;
  const id = ticketId(raffleId, number);

  await prisma.ticket.upsert({
    where: { id },
    update: {
      raffleId,
      numeroTicket: number,
      buyerId,
      estado: status,
      precioPagado: price,
      mpPaymentId,
      fechaCompra: purchasedAt,
      isDeleted: false,
      deletedAt: null,
    },
    create: {
      id,
      raffleId,
      numeroTicket: number,
      buyerId,
      estado: status,
      precioPagado: price,
      mpPaymentId,
      fechaCompra: purchasedAt,
    },
  });
}

async function upsertDrawResult(params: {
  raffleId: string;
  winningTicketId: string;
  winnerId: string;
  participants: number;
}) {
  const { raffleId, winningTicketId, winnerId, participants } = params;
  await prisma.drawResult.upsert({
    where: { raffleId },
    update: {
      winningTicketId,
      winnerId,
      method: 'RANDOM_INDEX',
      totalParticipants: participants,
      timestamp: new Date(),
      randomSeed: 'manual-qa',
    },
    create: {
      id: drawId(raffleId),
      raffleId,
      winningTicketId,
      winnerId,
      method: 'RANDOM_INDEX',
      totalParticipants: participants,
      timestamp: new Date(),
      randomSeed: 'manual-qa',
    },
  });
}

async function deleteDrawResultIfAny(raffleId: string) {
  await prisma.drawResult.deleteMany({
    where: { raffleId },
  });
}

async function upsertCategories() {
  for (const category of QA_CATEGORIES) {
    await prisma.category.upsert({
      where: { nombre: category.nombre },
      update: {
        descripcion: category.descripcion,
        icono: category.icono,
        orden: category.orden,
        isActive: true,
      },
      create: {
        nombre: category.nombre,
        descripcion: category.descripcion,
        icono: category.icono,
        orden: category.orden,
        isActive: true,
      },
    });
  }
}

async function upsertPayout(params: {
  raffleId: string;
  sellerId: string;
  grossAmount: number;
  platformFee: number;
  processingFee: number;
  netAmount: number;
  status: PayoutStatus;
  scheduledFor?: Date | null;
  processedAt?: Date | null;
  failureReason?: string | null;
}) {
  const {
    raffleId,
    sellerId,
    grossAmount,
    platformFee,
    processingFee,
    netAmount,
    status,
    scheduledFor = null,
    processedAt = null,
    failureReason = null,
  } = params;

  await prisma.payout.upsert({
    where: { raffleId },
    update: {
      sellerId,
      grossAmount,
      platformFee,
      processingFee,
      netAmount,
      status,
      scheduledFor,
      processedAt,
      failureReason,
    },
    create: {
      id: payoutId(raffleId),
      raffleId,
      sellerId,
      grossAmount,
      platformFee,
      processingFee,
      netAmount,
      status,
      scheduledFor,
      processedAt,
      failureReason,
    },
  });
}

async function upsertDispute(params: {
  raffleId: string;
  reporterId: string;
  type: DisputeType;
  status: DisputeStatus;
  title: string;
  description: string;
  createdAt?: Date;
  sellerResponse?: string | null;
  sellerEvidence?: string[];
  respondedAt?: Date | null;
  resolution?: string | null;
  refundAmount?: number | null;
  sellerAmount?: number | null;
  adminNotes?: string | null;
  resolvedAt?: Date | null;
}) {
  const {
    raffleId,
    reporterId,
    type,
    status,
    title,
    description,
    createdAt = new Date(),
    sellerResponse = null,
    sellerEvidence = [],
    respondedAt = null,
    resolution = null,
    refundAmount = null,
    sellerAmount = null,
    adminNotes = null,
    resolvedAt = null,
  } = params;

  await prisma.dispute.upsert({
    where: { raffleId },
    update: {
      reporterId,
      tipo: type,
      estado: status,
      titulo: title,
      descripcion: description,
      evidencias: ['https://picsum.photos/seed/manual-qa-dispute/600/400'],
      evidenciasVendedor: sellerEvidence,
      respuestaVendedor: sellerResponse,
      fechaRespuestaVendedor: respondedAt,
      resolucion: resolution,
      montoReembolsado: refundAmount,
      montoPagadoVendedor: sellerAmount,
      adminNotes,
      resolvedAt,
      createdAt,
      isDeleted: false,
      deletedAt: null,
    },
    create: {
      id: disputeId(raffleId),
      raffleId,
      reporterId,
      tipo: type,
      estado: status,
      titulo: title,
      descripcion: description,
      evidencias: ['https://picsum.photos/seed/manual-qa-dispute/600/400'],
      evidenciasVendedor: sellerEvidence,
      respuestaVendedor: sellerResponse,
      fechaRespuestaVendedor: respondedAt,
      resolucion: resolution,
      montoReembolsado: refundAmount,
      montoPagadoVendedor: sellerAmount,
      adminNotes,
      resolvedAt,
      createdAt,
    },
  });
}

async function main() {
  console.log('🌱 Running manual QA seed (Mercado Pago-free scenarios)...');

  const [userHash, adminHash] = await Promise.all([
    bcrypt.hash(DEFAULT_PASSWORD, 10),
    bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10),
  ]);

  const seller = await upsertUser({
    email: USERS.seller,
    nombre: 'QA',
    apellido: 'Seller',
    passwordHash: userHash,
    role: UserRole.USER,
    kycStatus: KycStatus.VERIFIED,
    mpConnectStatus: MpConnectStatus.CONNECTED,
    mpUserId: 'qa_mp_seller_001',
    mpAccessToken: 'qa_mock_access_token',
  });

  const buyer = await upsertUser({
    email: USERS.buyer,
    nombre: 'QA',
    apellido: 'Buyer',
    passwordHash: userHash,
    role: UserRole.USER,
    kycStatus: KycStatus.VERIFIED,
    mpConnectStatus: MpConnectStatus.NOT_CONNECTED,
  });

  const other = await upsertUser({
    email: USERS.other,
    nombre: 'QA',
    apellido: 'Other',
    passwordHash: userHash,
    role: UserRole.USER,
    kycStatus: KycStatus.VERIFIED,
    mpConnectStatus: MpConnectStatus.NOT_CONNECTED,
  });

  await upsertUser({
    email: USERS.admin,
    nombre: 'QA',
    apellido: 'Admin',
    passwordHash: adminHash,
    role: UserRole.ADMIN,
    kycStatus: KycStatus.VERIFIED,
    mpConnectStatus: MpConnectStatus.NOT_CONNECTED,
  });

  await upsertAddress({
    id: IDS.sellerAddress,
    userId: seller.id,
    label: 'Deposito QA',
    recipientName: 'QA Seller',
    street: 'Av. QA',
    number: '100',
    city: 'Buenos Aires',
    province: 'CABA',
    postalCode: '1000',
    isDefault: true,
  });

  await upsertAddress({
    id: IDS.buyerAddress,
    userId: buyer.id,
    label: 'Casa QA',
    recipientName: 'QA Buyer',
    street: 'Calle QA',
    number: '200',
    city: 'Buenos Aires',
    province: 'CABA',
    postalCode: '1001',
    isDefault: true,
  });

  await upsertAddress({
    id: IDS.otherAddress,
    userId: other.id,
    label: 'Casa QA Other',
    recipientName: 'QA Other',
    street: 'Calle QA Other',
    number: '300',
    city: 'Buenos Aires',
    province: 'CABA',
    postalCode: '1002',
    isDefault: true,
  });

  await prisma.user.update({
    where: { id: seller.id },
    data: { defaultSenderAddressId: IDS.sellerAddress },
  });

  await prisma.userReputation.upsert({
    where: { userId: seller.id },
    update: {
      maxRifasSimultaneas: 3,
    },
    create: {
      userId: seller.id,
      maxRifasSimultaneas: 3,
      nivelVendedor: 'NUEVO',
    },
  });

  await upsertCategories();

  // 1) Public active raffle (visible in search)
  await upsertRaffle({
    id: IDS.raffleActive,
    sellerId: seller.id,
    title: `${QA_PREFIX} iPhone 15 Pro - Activa`,
    description: 'Rifa activa visible para pruebas de listado y compra.',
    totalTickets: 20,
    price: 1500,
    deadline: daysFromNow(10),
    status: RaffleStatus.ACTIVA,
    deliveryStatus: DeliveryStatus.PENDING,
  });
  await upsertTicket({
    raffleId: IDS.raffleActive,
    number: 1,
    buyerId: buyer.id,
    status: TicketStatus.PAGADO,
    price: 1500,
    mpPaymentId: 'qa_mp_active_1',
    purchasedAt: daysAgo(1),
  });
  await upsertTicket({
    raffleId: IDS.raffleActive,
    number: 2,
    buyerId: other.id,
    status: TicketStatus.PAGADO,
    price: 1500,
    mpPaymentId: 'qa_mp_active_2',
    purchasedAt: daysAgo(1),
  });

  // 2) Hidden raffle (should not appear publicly)
  await upsertRaffle({
    id: IDS.raffleHidden,
    sellerId: seller.id,
    title: `${QA_PREFIX} Oculta`,
    description: 'Rifa oculta para pruebas de visibilidad.',
    totalTickets: 10,
    price: 900,
    deadline: daysFromNow(15),
    status: RaffleStatus.FINALIZADA,
    deliveryStatus: DeliveryStatus.CONFIRMED,
    isHidden: true,
    paymentReleasedAt: daysAgo(5),
  });

  // 3) Soft-deleted raffle (should not appear publicly)
  await upsertRaffle({
    id: IDS.raffleDeleted,
    sellerId: seller.id,
    title: `${QA_PREFIX} Eliminada`,
    description: 'Rifa eliminada para pruebas de visibilidad.',
    totalTickets: 10,
    price: 800,
    deadline: daysFromNow(7),
    status: RaffleStatus.CANCELADA,
    deliveryStatus: DeliveryStatus.PENDING,
    isDeleted: true,
  });

  // 4) COMPLETADA without draw (recovery draw path)
  await upsertRaffle({
    id: IDS.raffleCompletedNoDraw,
    sellerId: seller.id,
    title: `${QA_PREFIX} Completa sin Sorteo`,
    description:
      'Rifa vendida al 100% en COMPLETADA sin winner para probar auto-draw.',
    totalTickets: 5,
    price: 700,
    deadline: daysAgo(1),
    status: RaffleStatus.COMPLETADA,
    deliveryStatus: DeliveryStatus.PENDING,
  });
  await deleteDrawResultIfAny(IDS.raffleCompletedNoDraw);
  for (let n = 1; n <= 5; n++) {
    await upsertTicket({
      raffleId: IDS.raffleCompletedNoDraw,
      number: n,
      buyerId: n <= 3 ? buyer.id : other.id,
      status: TicketStatus.PAGADO,
      price: 700,
      mpPaymentId: `qa_mp_completed_${n}`,
      purchasedAt: daysAgo(2),
    });
  }

  // 5) Winner selected, not shipped yet (confirm should fail)
  await upsertRaffle({
    id: IDS.raffleSorteadaPending,
    sellerId: seller.id,
    title: `${QA_PREFIX} Sorteada pendiente envío`,
    description: 'Ganador definido, sin envío para probar bloqueo de confirmación.',
    totalTickets: 6,
    price: 1200,
    deadline: daysAgo(3),
    status: RaffleStatus.SORTEADA,
    deliveryStatus: DeliveryStatus.PENDING,
    winnerId: buyer.id,
    drawDate: daysAgo(2),
  });
  for (let n = 1; n <= 3; n++) {
    await upsertTicket({
      raffleId: IDS.raffleSorteadaPending,
      number: n,
      buyerId: n === 1 ? buyer.id : other.id,
      status: TicketStatus.PAGADO,
      price: 1200,
      mpPaymentId: `qa_mp_pending_ship_${n}`,
      purchasedAt: daysAgo(3),
    });
  }
  await upsertDrawResult({
    raffleId: IDS.raffleSorteadaPending,
    winningTicketId: ticketId(IDS.raffleSorteadaPending, 1),
    winnerId: buyer.id,
    participants: 3,
  });

  // 6) Already shipped (winner can confirm from frontend)
  await upsertRaffle({
    id: IDS.raffleShipped,
    sellerId: seller.id,
    title: `${QA_PREFIX} Enviada esperando confirmación`,
    description: 'Entrega enviada para probar confirmación del ganador.',
    totalTickets: 6,
    price: 1300,
    deadline: daysAgo(6),
    status: RaffleStatus.EN_ENTREGA,
    deliveryStatus: DeliveryStatus.SHIPPED,
    winnerId: buyer.id,
    drawDate: daysAgo(5),
    trackingNumber: 'QA-TRACK-12345',
    shippedAt: daysAgo(1),
  });
  for (let n = 1; n <= 3; n++) {
    await upsertTicket({
      raffleId: IDS.raffleShipped,
      number: n,
      buyerId: n === 1 ? buyer.id : other.id,
      status: TicketStatus.PAGADO,
      price: 1300,
      mpPaymentId: `qa_mp_shipped_${n}`,
      purchasedAt: daysAgo(5),
    });
  }
  await upsertDrawResult({
    raffleId: IDS.raffleShipped,
    winningTicketId: ticketId(IDS.raffleShipped, 1),
    winnerId: buyer.id,
    participants: 3,
  });
  await upsertPayout({
    raffleId: IDS.raffleShipped,
    sellerId: seller.id,
    grossAmount: 3900,
    platformFee: 156,
    processingFee: 195,
    netAmount: 3549,
    status: PayoutStatus.PENDING,
    scheduledFor: daysFromNow(1),
  });

  // 7) Already finalized with completed payout
  await upsertRaffle({
    id: IDS.raffleFinalizedPayout,
    sellerId: seller.id,
    title: `${QA_PREFIX} Finalizada con pago`,
    description: 'Caso finalizado para probar historial de payouts.',
    totalTickets: 5,
    price: 1600,
    deadline: daysAgo(15),
    status: RaffleStatus.FINALIZADA,
    deliveryStatus: DeliveryStatus.CONFIRMED,
    winnerId: buyer.id,
    drawDate: daysAgo(13),
    trackingNumber: 'QA-FINAL-TRACK',
    shippedAt: daysAgo(12),
    confirmedAt: daysAgo(11),
    paymentReleasedAt: daysAgo(10),
  });
  for (let n = 1; n <= 3; n++) {
    await upsertTicket({
      raffleId: IDS.raffleFinalizedPayout,
      number: n,
      buyerId: n === 1 ? buyer.id : other.id,
      status: TicketStatus.PAGADO,
      price: 1600,
      mpPaymentId: `qa_mp_final_${n}`,
      purchasedAt: daysAgo(14),
    });
  }
  await upsertDrawResult({
    raffleId: IDS.raffleFinalizedPayout,
    winningTicketId: ticketId(IDS.raffleFinalizedPayout, 1),
    winnerId: buyer.id,
    participants: 3,
  });
  await upsertPayout({
    raffleId: IDS.raffleFinalizedPayout,
    sellerId: seller.id,
    grossAmount: 4800,
    platformFee: 192,
    processingFee: 240,
    netAmount: 4368,
    status: PayoutStatus.COMPLETED,
    scheduledFor: daysAgo(11),
    processedAt: daysAgo(10),
  });

  // 8) Cancelled raffle with price reduction (relaunch flow)
  await upsertRaffle({
    id: IDS.raffleCancelledRelaunch,
    sellerId: seller.id,
    title: `${QA_PREFIX} Cancelada para relanzar`,
    description: 'Escenario de relanzamiento con precio sugerido.',
    totalTickets: 20,
    price: 1000,
    deadline: daysAgo(4),
    status: RaffleStatus.CANCELADA,
    deliveryStatus: DeliveryStatus.PENDING,
  });
  await prisma.priceReduction.upsert({
    where: { id: IDS.priceReduction },
    update: {
      raffleId: IDS.raffleCancelledRelaunch,
      precioAnterior: 1000,
      precioSugerido: 750,
      porcentajeReduccion: 25,
      ticketsVendidosAlMomento: 8,
      aceptada: null,
      fechaRespuesta: null,
      isDeleted: false,
      deletedAt: null,
    },
    create: {
      id: IDS.priceReduction,
      raffleId: IDS.raffleCancelledRelaunch,
      precioAnterior: 1000,
      precioSugerido: 750,
      porcentajeReduccion: 25,
      ticketsVendidosAlMomento: 8,
    },
  });

  // 9) Expired active raffle with <70% sold (refund/cancel cron path)
  await upsertRaffle({
    id: IDS.raffleExpiredLowSale,
    sellerId: seller.id,
    title: `${QA_PREFIX} Expirada bajo 70%`,
    description: 'Escenario para cancelación y reembolso por bajo porcentaje vendido.',
    totalTickets: 10,
    price: 500,
    deadline: daysAgo(2),
    status: RaffleStatus.ACTIVA,
    deliveryStatus: DeliveryStatus.PENDING,
  });
  for (let n = 1; n <= 4; n++) {
    await upsertTicket({
      raffleId: IDS.raffleExpiredLowSale,
      number: n,
      buyerId: n <= 2 ? buyer.id : other.id,
      status: TicketStatus.PAGADO,
      price: 500,
      mpPaymentId: `qa_mp_low_sale_${n}`,
      purchasedAt: daysAgo(3),
    });
  }

  // 10) Dispute scenarios for buyer/seller/admin pages
  await upsertRaffle({
    id: IDS.raffleDisputeOpen,
    sellerId: seller.id,
    title: `${QA_PREFIX} Disputa abierta`,
    description: 'Rifa con disputa ABIERTA.',
    totalTickets: 5,
    price: 900,
    deadline: daysAgo(8),
    status: RaffleStatus.SORTEADA,
    deliveryStatus: DeliveryStatus.DISPUTED,
    winnerId: buyer.id,
    drawDate: daysAgo(7),
  });
  await upsertTicket({
    raffleId: IDS.raffleDisputeOpen,
    number: 1,
    buyerId: buyer.id,
    status: TicketStatus.PAGADO,
    price: 900,
    mpPaymentId: 'qa_mp_dispute_open_1',
    purchasedAt: daysAgo(8),
  });
  await upsertDrawResult({
    raffleId: IDS.raffleDisputeOpen,
    winningTicketId: ticketId(IDS.raffleDisputeOpen, 1),
    winnerId: buyer.id,
    participants: 1,
  });
  await upsertDispute({
    raffleId: IDS.raffleDisputeOpen,
    reporterId: buyer.id,
    type: DisputeType.NO_LLEGO,
    status: DisputeStatus.ABIERTA,
    title: `${QA_PREFIX} No llego el premio`,
    description:
      'Disputa abierta de QA para validar paneles de comprador, vendedor y admin.',
    createdAt: daysAgo(2),
  });

  await upsertRaffle({
    id: IDS.raffleDisputeMediation,
    sellerId: seller.id,
    title: `${QA_PREFIX} Disputa en mediacion`,
    description: 'Rifa con disputa EN_MEDIACION y respuesta del vendedor.',
    totalTickets: 5,
    price: 950,
    deadline: daysAgo(10),
    status: RaffleStatus.SORTEADA,
    deliveryStatus: DeliveryStatus.DISPUTED,
    winnerId: buyer.id,
    drawDate: daysAgo(9),
  });
  await upsertTicket({
    raffleId: IDS.raffleDisputeMediation,
    number: 1,
    buyerId: buyer.id,
    status: TicketStatus.PAGADO,
    price: 950,
    mpPaymentId: 'qa_mp_dispute_med_1',
    purchasedAt: daysAgo(10),
  });
  await upsertDrawResult({
    raffleId: IDS.raffleDisputeMediation,
    winningTicketId: ticketId(IDS.raffleDisputeMediation, 1),
    winnerId: buyer.id,
    participants: 1,
  });
  await upsertDispute({
    raffleId: IDS.raffleDisputeMediation,
    reporterId: buyer.id,
    type: DisputeType.DIFERENTE,
    status: DisputeStatus.EN_MEDIACION,
    title: `${QA_PREFIX} Producto diferente`,
    description:
      'Disputa en mediación de QA con respuesta del vendedor para probar resolución parcial.',
    createdAt: daysAgo(5),
    sellerResponse: 'Respondimos con pruebas de envío y detalles del producto.',
    sellerEvidence: ['https://picsum.photos/seed/manual-qa-seller/600/400'],
    respondedAt: daysAgo(4),
  });

  await upsertRaffle({
    id: IDS.raffleDisputeOld,
    sellerId: seller.id,
    title: `${QA_PREFIX} Disputa antigua`,
    description: 'Rifa con disputa antigua para cron de auto-resolución.',
    totalTickets: 5,
    price: 1000,
    deadline: daysAgo(25),
    status: RaffleStatus.SORTEADA,
    deliveryStatus: DeliveryStatus.DISPUTED,
    winnerId: buyer.id,
    drawDate: daysAgo(24),
  });
  await upsertTicket({
    raffleId: IDS.raffleDisputeOld,
    number: 1,
    buyerId: buyer.id,
    status: TicketStatus.PAGADO,
    price: 1000,
    mpPaymentId: 'qa_mp_dispute_old_1',
    purchasedAt: daysAgo(24),
  });
  await upsertDrawResult({
    raffleId: IDS.raffleDisputeOld,
    winningTicketId: ticketId(IDS.raffleDisputeOld, 1),
    winnerId: buyer.id,
    participants: 1,
  });
  await upsertDispute({
    raffleId: IDS.raffleDisputeOld,
    reporterId: buyer.id,
    type: DisputeType.VENDEDOR_NO_RESPONDE,
    status: DisputeStatus.ESPERANDO_RESPUESTA_VENDEDOR,
    title: `${QA_PREFIX} Sin respuesta vendedor`,
    description:
      'Disputa antigua para verificar auto-refund por cron si supera 15 dias.',
    createdAt: daysAgo(20),
  });

  console.log('✅ Manual QA seed completed');
  console.log('Login accounts created/updated:');
  console.log(`- Seller: ${USERS.seller} / ${DEFAULT_PASSWORD}`);
  console.log(`- Buyer:  ${USERS.buyer} / ${DEFAULT_PASSWORD}`);
  console.log(`- Other:  ${USERS.other} / ${DEFAULT_PASSWORD}`);
  console.log(`- Admin:  ${USERS.admin} / ${DEFAULT_ADMIN_PASSWORD}`);
  console.log('');
  console.log('Suggested UI smoke routes:');
  console.log('- /search');
  console.log('- /dashboard/create');
  console.log('- /dashboard/sales');
  console.log('- /dashboard/tickets');
  console.log('- /dashboard/disputes');
  console.log('- /admin/disputes');
  console.log('- /dashboard/payouts');
  console.log(
    `- /dashboard/sales?action=relaunch&priceReductionId=${IDS.priceReduction}`,
  );
}

main()
  .catch((error) => {
    console.error('❌ Manual QA seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

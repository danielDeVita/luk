import {
  Prisma,
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
  DocumentType,
  PromotionBonusGrantStatus,
  SocialPromotionNetwork,
  SocialPromotionStatus,
  SocialPromotionAttributionEventType,
  SellerLevel,
  TransactionType,
  TransactionStatus,
  ActivityType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const QA_PREFIX = '[QA]';
const DEFAULT_PASSWORD = 'Password123!';
const DEFAULT_ADMIN_PASSWORD = 'Admin123!';

const USERS = {
  seller: 'vendedor@test.com',
  buyer: 'comprador@test.com',
  other: 'otro@test.com',
  admin: 'admin@test.com',
  unverifiedKyc: 'unverified@test.com',
  pendingKyc: 'pending-kyc@test.com',
  rejectedKyc: 'rejected-kyc@test.com',
  sellerPro: 'seller-pro@test.com',
  sellerGrowth: 'seller-growth@test.com',
  sellerNoMp: 'seller-no-mp@test.com',
  sellerNoAddress: 'seller-no-address@test.com',
  sellerPendingMp: 'seller-pending-mp@test.com',
  buyerHeavy: 'buyer-heavy@test.com',
  buyerWinner: 'buyer-winner@test.com',
  buyerRefund: 'buyer-refund@test.com',
  buyerDispute: 'buyer-dispute@test.com',
  buyerNew: 'buyer-new@test.com',
  buyerPromo: 'buyer-promo@test.com',
  buyerPack: 'buyer-pack@test.com',
  googleOnly: 'google-only@test.com',
  unverifiedEmail: 'email-unverified@test.com',
  banned: 'banned-user@test.com',
  adminOps: 'admin-ops@test.com',
} as const;

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
  raffleDisputeResolvedBuyer: 'qa_raffle_dispute_resolved_buyer',
  raffleBonusTargetOther: 'qa_raffle_bonus_target_other',
  priceReduction: 'qa_price_reduction_1',
  reportActiveRaffle: 'qa_report_active_raffle',
  socialDraft: 'qa_social_promo_bonus_draft',
  socialPost: 'qa_social_promo_bonus_post',
  socialSnapshot: 'qa_social_promo_bonus_snapshot',
  socialSettlement: 'qa_social_promo_bonus_settlement',
  socialGrant: 'qa_social_promo_bonus_grant',
  socialClickEvent: 'qa_social_attr_click',
  socialRegistrationEvent: 'qa_social_attr_registration',
  socialPurchaseEvent: 'qa_social_attr_purchase',
  rafflePackFive: 'qa_raffle_pack_five_random',
  rafflePackTen: 'qa_raffle_pack_ten_random',
  rafflePackLowStock: 'qa_raffle_pack_low_stock',
  rafflePackBuyerLimit: 'qa_raffle_pack_buyer_limit',
  raffleChooseNumbers: 'qa_raffle_choose_numbers_premium',
  rafflePriceDropActive: 'qa_raffle_active_price_drop',
  raffleAlmostSold: 'qa_raffle_active_almost_sold',
  raffleNewLaunch: 'qa_raffle_new_launch',
  raffleHomeActive: 'qa_raffle_home_active',
  raffleFashionActive: 'qa_raffle_fashion_active',
  raffleSportsActive: 'qa_raffle_sports_active',
  raffleEntertainmentActive: 'qa_raffle_entertainment_active',
  raffleCancelledRefunded: 'qa_raffle_cancelled_refunded',
  raffleFinalizedGrowthReviewed: 'qa_raffle_finalized_growth_reviewed',
  raffleFinalizedReviewed: 'qa_raffle_finalized_reviewed',
  raffleDisputeResolvedSeller: 'qa_raffle_dispute_resolved_seller',
  raffleDisputeResolvedPartial: 'qa_raffle_dispute_resolved_partial',
} as const;

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

function hoursAgo(hours: number): Date {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date;
}

function ticketId(raffleId: string, number: number): string {
  return `qa_ticket_${raffleId}_${number}`;
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

function addressId(key: string): string {
  return `qa_addr_${key}_default`;
}

function priceHistoryId(raffleId: string, index: number): string {
  return `qa_price_history_${raffleId}_${index}`;
}

function reviewId(raffleId: string): string {
  return `qa_review_${raffleId}`;
}

function questionId(raffleId: string, index: number): string {
  return `qa_question_${raffleId}_${index}`;
}

function answerId(raffleId: string, index: number): string {
  return `qa_answer_${raffleId}_${index}`;
}

function conversationId(raffleId: string): string {
  return `qa_conversation_${raffleId}`;
}

function messageId(raffleId: string, index: number): string {
  return `qa_message_${raffleId}_${index}`;
}

function transactionId(key: string): string {
  return `qa_tx_${key}`;
}

function notificationId(key: string): string {
  return `qa_notification_${key}`;
}

function activityLogId(key: string): string {
  return `qa_activity_${key}`;
}

function emailVerificationCodeId(key: string): string {
  return `qa_email_code_${key}`;
}

function reportId(raffleId: string, reporterId: string): string {
  return `qa_report_${raffleId}_${reporterId}`;
}

async function upsertUser(params: {
  email: string;
  nombre: string;
  apellido: string;
  passwordHash?: string | null;
  role?: UserRole;
  emailVerified?: boolean;
  kycStatus?: KycStatus;
  kycSubmittedAt?: Date | null;
  kycVerifiedAt?: Date | null;
  kycRejectedReason?: string | null;
  mpConnectStatus?: MpConnectStatus;
  mpUserId?: string | null;
  mpAccessToken?: string | null;
  documentType?: DocumentType | null;
  documentNumber?: string | null;
  googleId?: string | null;
  avatarUrl?: string | null;
  createdAt?: Date;
}) {
  const {
    email,
    nombre,
    apellido,
    passwordHash = null,
    role = UserRole.USER,
    emailVerified = true,
    kycStatus = KycStatus.NOT_SUBMITTED,
    kycSubmittedAt = null,
    kycVerifiedAt = null,
    kycRejectedReason = null,
    mpConnectStatus = MpConnectStatus.NOT_CONNECTED,
    mpUserId = null,
    mpAccessToken = null,
    documentType = null,
    documentNumber = null,
    googleId = null,
    avatarUrl = null,
    createdAt = new Date(),
  } = params;
  const emailVerifiedAt = emailVerified ? createdAt : null;
  const resolvedKycVerifiedAt =
    kycVerifiedAt ?? (kycStatus === KycStatus.VERIFIED ? createdAt : null);

  return prisma.user.upsert({
    where: { email },
    update: {
      nombre,
      apellido,
      passwordHash,
      role,
      emailVerified,
      emailVerifiedAt,
      termsAcceptedAt: createdAt,
      termsVersion: '1.0',
      kycStatus,
      kycSubmittedAt,
      kycVerifiedAt: resolvedKycVerifiedAt,
      kycRejectedReason,
      mpConnectStatus,
      mpUserId,
      mpAccessToken,
      documentType,
      documentNumber,
      googleId,
      avatarUrl,
      createdAt,
      isDeleted: false,
      deletedAt: null,
    },
    create: {
      email,
      nombre,
      apellido,
      passwordHash,
      role,
      emailVerified,
      emailVerifiedAt,
      termsAcceptedAt: createdAt,
      termsVersion: '1.0',
      kycStatus,
      kycSubmittedAt,
      kycVerifiedAt: resolvedKycVerifiedAt,
      kycRejectedReason,
      mpConnectStatus,
      mpUserId,
      mpAccessToken,
      documentType,
      documentNumber,
      googleId,
      avatarUrl,
      createdAt,
    },
  });
}

async function upsertUserReputation(params: {
  userId: string;
  maxRifasSimultaneas?: number;
  nivelVendedor?: SellerLevel;
  totalVentasCompletadas?: number;
  totalComprasCompletadas?: number;
  totalRifasGanadas?: number;
  totalTicketsComprados?: number;
  disputasComoVendedorGanadas?: number;
  disputasComoVendedorPerdidas?: number;
  disputasComoCompradorAbiertas?: number;
  ratingPromedioVendedor?: number | null;
}) {
  const {
    userId,
    maxRifasSimultaneas = 3,
    nivelVendedor = SellerLevel.NUEVO,
    totalVentasCompletadas = 0,
    totalComprasCompletadas = 0,
    totalRifasGanadas = 0,
    totalTicketsComprados = 0,
    disputasComoVendedorGanadas = 0,
    disputasComoVendedorPerdidas = 0,
    disputasComoCompradorAbiertas = 0,
    ratingPromedioVendedor = null,
  } = params;

  await prisma.userReputation.upsert({
    where: { userId },
    update: {
      maxRifasSimultaneas,
      nivelVendedor,
      totalVentasCompletadas,
      totalComprasCompletadas,
      totalRifasGanadas,
      totalTicketsComprados,
      disputasComoVendedorGanadas,
      disputasComoVendedorPerdidas,
      disputasComoCompradorAbiertas,
      ratingPromedioVendedor,
    },
    create: {
      userId,
      maxRifasSimultaneas,
      nivelVendedor,
      totalVentasCompletadas,
      totalComprasCompletadas,
      totalRifasGanadas,
      totalTicketsComprados,
      disputasComoVendedorGanadas,
      disputasComoVendedorPerdidas,
      disputasComoCompradorAbiertas,
      ratingPromedioVendedor,
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

async function upsertCategories() {
  const categories = new Map<string, string>();

  for (const category of QA_CATEGORIES) {
    const created = await prisma.category.upsert({
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

    categories.set(category.nombre, created.id);
  }

  return categories;
}

async function upsertRaffle(params: {
  id: string;
  sellerId: string;
  categoryId?: string | null;
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
  viewCount?: number;
  lastPriceDropAt?: Date | null;
  productName?: string;
  productCategory?: string;
  productCondition?: ProductCondition;
}) {
  const {
    id,
    sellerId,
    categoryId = null,
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
    viewCount = 0,
    lastPriceDropAt = null,
    productName = `${title} - Producto`,
    productCategory = 'Electronica',
    productCondition = ProductCondition.NUEVO,
  } = params;

  await prisma.raffle.upsert({
    where: { id },
    update: {
      titulo: title,
      descripcion: description,
      sellerId,
      categoryId,
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
      viewCount,
      lastPriceDropAt,
      isHidden,
      isDeleted,
      deletedAt: isDeleted ? new Date() : null,
      hiddenReason: isHidden ? 'Fixture oculto para QA manual' : null,
    },
    create: {
      id,
      titulo: title,
      descripcion: description,
      sellerId,
      categoryId,
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
      viewCount,
      lastPriceDropAt,
      isHidden,
      isDeleted,
      deletedAt: isDeleted ? new Date() : null,
      hiddenReason: isHidden ? 'Fixture oculto para QA manual' : null,
    },
  });

  await prisma.product.upsert({
    where: { raffleId: id },
    update: {
      nombre: productName,
      descripcionDetallada: `Producto de prueba para ${title}.`,
      categoria: productCategory,
      condicion: productCondition,
      imagenes: [`https://picsum.photos/seed/${id}/800/600`],
      especificacionesTecnicas: {
        source: 'canonical-seed',
      },
    },
    create: {
      id: `qa_product_${id}`,
      raffleId: id,
      nombre: productName,
      descripcionDetallada: `Producto de prueba para ${title}.`,
      categoria: productCategory,
      condicion: productCondition,
      imagenes: [`https://picsum.photos/seed/${id}/800/600`],
      especificacionesTecnicas: {
        source: 'canonical-seed',
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

  await prisma.ticket.upsert({
    where: { id: ticketId(raffleId, number) },
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
      id: ticketId(raffleId, number),
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
      randomSeed: 'canonical-seed',
    },
    create: {
      id: drawId(raffleId),
      raffleId,
      winningTicketId,
      winnerId,
      method: 'RANDOM_INDEX',
      totalParticipants: participants,
      timestamp: new Date(),
      randomSeed: 'canonical-seed',
    },
  });
}

async function deleteDrawResultIfAny(raffleId: string) {
  await prisma.drawResult.deleteMany({
    where: { raffleId },
  });
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
  buyerEvidence?: string[];
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
    buyerEvidence = ['https://picsum.photos/seed/canonical-dispute/600/400'],
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
      evidencias: buyerEvidence,
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
      evidencias: buyerEvidence,
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

async function upsertFavorite(
  userId: string,
  raffleId: string,
  createdAt = new Date(),
) {
  await prisma.favorite.upsert({
    where: {
      userId_raffleId: {
        userId,
        raffleId,
      },
    },
    update: {
      createdAt,
    },
    create: {
      userId,
      raffleId,
      createdAt,
    },
  });
}

async function upsertPriceHistory(params: {
  id: string;
  raffleId: string;
  previousPrice: number;
  newPrice: number;
  changedAt: Date;
}) {
  const { id, raffleId, previousPrice, newPrice, changedAt } = params;

  await prisma.priceHistory.upsert({
    where: { id },
    update: {
      raffleId,
      previousPrice,
      newPrice,
      changedAt,
    },
    create: {
      id,
      raffleId,
      previousPrice,
      newPrice,
      changedAt,
    },
  });
}

async function upsertReview(params: {
  raffleId: string;
  reviewerId: string;
  sellerId: string;
  rating: number;
  comentario: string;
  createdAt?: Date;
  commentHidden?: boolean;
  commentHiddenReason?: string | null;
  commentHiddenAt?: Date | null;
  commentHiddenById?: string | null;
}) {
  const {
    raffleId,
    reviewerId,
    sellerId,
    rating,
    comentario,
    createdAt = new Date(),
    commentHidden = false,
    commentHiddenReason = null,
    commentHiddenAt = null,
    commentHiddenById = null,
  } = params;

  await prisma.review.upsert({
    where: { raffleId },
    update: {
      reviewerId,
      sellerId,
      rating,
      comentario,
      commentHidden,
      commentHiddenReason,
      commentHiddenAt,
      commentHiddenById,
      createdAt,
    },
    create: {
      id: reviewId(raffleId),
      raffleId,
      reviewerId,
      sellerId,
      rating,
      comentario,
      commentHidden,
      commentHiddenReason,
      commentHiddenAt,
      commentHiddenById,
      createdAt,
    },
  });
}

async function upsertQuestionThread(params: {
  raffleId: string;
  index: number;
  askerId: string;
  question: string;
  questionCreatedAt?: Date;
  sellerId?: string | null;
  answer?: string | null;
  answerCreatedAt?: Date | null;
}) {
  const {
    raffleId,
    index,
    askerId,
    question,
    questionCreatedAt = new Date(),
    sellerId = null,
    answer = null,
    answerCreatedAt = null,
  } = params;

  const createdQuestion = await prisma.raffleQuestion.upsert({
    where: { id: questionId(raffleId, index) },
    update: {
      raffleId,
      askerId,
      content: question,
      createdAt: questionCreatedAt,
    },
    create: {
      id: questionId(raffleId, index),
      raffleId,
      askerId,
      content: question,
      createdAt: questionCreatedAt,
    },
  });

  if (!sellerId || !answer) {
    return createdQuestion;
  }

  await prisma.raffleAnswer.upsert({
    where: { questionId: createdQuestion.id },
    update: {
      sellerId,
      content: answer,
      createdAt: answerCreatedAt ?? questionCreatedAt,
    },
    create: {
      id: answerId(raffleId, index),
      questionId: createdQuestion.id,
      sellerId,
      content: answer,
      createdAt: answerCreatedAt ?? questionCreatedAt,
    },
  });

  return createdQuestion;
}

async function upsertConversationThread(params: {
  raffleId: string;
  user1Id: string;
  user2Id: string;
  messages: Array<{
    index: number;
    senderId: string;
    content: string;
    isRead?: boolean;
    createdAt?: Date;
  }>;
}) {
  const { raffleId, user1Id, user2Id, messages } = params;

  const conversation = await prisma.conversation.upsert({
    where: { raffleId },
    update: {
      user1Id,
      user2Id,
      isActive: true,
    },
    create: {
      id: conversationId(raffleId),
      raffleId,
      user1Id,
      user2Id,
      isActive: true,
    },
  });

  for (const message of messages) {
    await prisma.message.upsert({
      where: { id: messageId(raffleId, message.index) },
      update: {
        conversationId: conversation.id,
        senderId: message.senderId,
        content: message.content,
        isRead: message.isRead ?? false,
        createdAt: message.createdAt ?? new Date(),
      },
      create: {
        id: messageId(raffleId, message.index),
        conversationId: conversation.id,
        senderId: message.senderId,
        content: message.content,
        isRead: message.isRead ?? false,
        createdAt: message.createdAt ?? new Date(),
      },
    });
  }
}

async function upsertTransaction(params: {
  id: string;
  tipo: TransactionType;
  userId: string;
  raffleId: string;
  monto: number;
  grossAmount?: number | null;
  promotionDiscountAmount?: number | null;
  cashChargedAmount?: number | null;
  comisionPlataforma?: number | null;
  feeProcesamiento?: number | null;
  montoNeto?: number | null;
  mpPaymentId?: string | null;
  mpMerchantOrderId?: string | null;
  estado?: TransactionStatus;
  metadata?: Prisma.InputJsonValue;
}) {
  const {
    id,
    tipo,
    userId,
    raffleId,
    monto,
    grossAmount = null,
    promotionDiscountAmount = null,
    cashChargedAmount = null,
    comisionPlataforma = null,
    feeProcesamiento = null,
    montoNeto = null,
    mpPaymentId = null,
    mpMerchantOrderId = null,
    estado = TransactionStatus.COMPLETADO,
    metadata = undefined,
  } = params;

  await prisma.transaction.upsert({
    where: { id },
    update: {
      tipo,
      userId,
      raffleId,
      monto,
      grossAmount,
      promotionDiscountAmount,
      cashChargedAmount,
      comisionPlataforma,
      feeProcesamiento,
      montoNeto,
      mpPaymentId,
      mpMerchantOrderId,
      estado,
      metadata,
      isDeleted: false,
      deletedAt: null,
    },
    create: {
      id,
      tipo,
      userId,
      raffleId,
      monto,
      grossAmount,
      promotionDiscountAmount,
      cashChargedAmount,
      comisionPlataforma,
      feeProcesamiento,
      montoNeto,
      mpPaymentId,
      mpMerchantOrderId,
      estado,
      metadata,
    },
  });
}

async function upsertNotification(params: {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  read?: boolean;
  createdAt?: Date;
}) {
  const {
    id,
    userId,
    type,
    title,
    message,
    actionUrl = null,
    read = false,
    createdAt = new Date(),
  } = params;

  await prisma.notification.upsert({
    where: { id },
    update: {
      userId,
      type,
      title,
      message,
      actionUrl,
      read,
      createdAt,
    },
    create: {
      id,
      userId,
      type,
      title,
      message,
      actionUrl,
      read,
      createdAt,
    },
  });
}

async function upsertActivityLog(params: {
  id: string;
  userId: string;
  action: ActivityType;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt?: Date;
}) {
  const {
    id,
    userId,
    action,
    targetType = null,
    targetId = null,
    metadata = undefined,
    ipAddress = null,
    userAgent = null,
    createdAt = new Date(),
  } = params;

  await prisma.activityLog.upsert({
    where: { id },
    update: {
      userId,
      action,
      targetType,
      targetId,
      metadata,
      ipAddress,
      userAgent,
      createdAt,
    },
    create: {
      id,
      userId,
      action,
      targetType,
      targetId,
      metadata,
      ipAddress,
      userAgent,
      createdAt,
    },
  });
}

async function upsertEmailVerificationCode(params: {
  id: string;
  userId: string;
  code: string;
  expiresAt: Date;
  attempts?: number;
  maxAttempts?: number;
  isUsed?: boolean;
  usedAt?: Date | null;
  createdAt?: Date;
}) {
  const {
    id,
    userId,
    code,
    expiresAt,
    attempts = 0,
    maxAttempts = 3,
    isUsed = false,
    usedAt = null,
    createdAt = new Date(),
  } = params;

  await prisma.emailVerificationCode.upsert({
    where: { id },
    update: {
      userId,
      code,
      expiresAt,
      attempts,
      maxAttempts,
      isUsed,
      usedAt,
      createdAt,
    },
    create: {
      id,
      userId,
      code,
      expiresAt,
      attempts,
      maxAttempts,
      isUsed,
      usedAt,
      createdAt,
    },
  });
}

async function upsertSampleReport(raffleId: string, reporterId: string) {
  await prisma.report.upsert({
    where: {
      raffleId_reporterId: {
        raffleId,
        reporterId,
      },
    },
    update: {
      reason: 'Fixture QA para validar listado y review de reportes en admin.',
      reviewed: false,
      reviewedAt: null,
      adminNotes: null,
    },
    create: {
      id: reportId(raffleId, reporterId),
      raffleId,
      reporterId,
      reason: 'Fixture QA para validar listado y review de reportes en admin.',
      reviewed: false,
    },
  });
}

async function upsertSocialPromotionFixture(params: {
  sellerId: string;
  sellerEmail: string;
  sellerName: string;
  sourceRaffleId: string;
}) {
  const { sellerId, sellerEmail, sellerName, sourceRaffleId } = params;
  const expiresAt = daysFromNow(30);
  const settledAt = hoursAgo(12);
  const validatedAt = hoursAgo(14);
  const submittedAt = hoursAgo(16);

  await prisma.promotionBonusRedemption.deleteMany({
    where: { promotionBonusGrantId: IDS.socialGrant },
  });

  await prisma.socialPromotionDraft.upsert({
    where: { id: IDS.socialDraft },
    update: {
      raffleId: sourceRaffleId,
      sellerId,
      network: SocialPromotionNetwork.X,
      trackingUrl:
        'http://localhost:3001/social-promotions/track/promo-qa-grant-fixture',
      promotionToken: 'promo-qa-grant-fixture',
      suggestedCopy:
        'Fixture QA de promoción social para probar métricas, settlement y grant.',
      expiresAt,
    },
    create: {
      id: IDS.socialDraft,
      raffleId: sourceRaffleId,
      sellerId,
      network: SocialPromotionNetwork.X,
      trackingUrl:
        'http://localhost:3001/social-promotions/track/promo-qa-grant-fixture',
      promotionToken: 'promo-qa-grant-fixture',
      suggestedCopy:
        'Fixture QA de promoción social para probar métricas, settlement y grant.',
      expiresAt,
    },
  });

  await prisma.socialPromotionPost.upsert({
    where: { id: IDS.socialPost },
    update: {
      draftId: IDS.socialDraft,
      raffleId: sourceRaffleId,
      sellerId,
      network: SocialPromotionNetwork.X,
      submittedPermalink: 'https://x.com/luk/status/promo-qa-grant-fixture',
      canonicalPermalink: 'https://x.com/luk/status/promo-qa-grant-fixture',
      canonicalPostId: 'promo-qa-grant-fixture',
      status: SocialPromotionStatus.SETTLED,
      publishedAt: submittedAt,
      submittedAt,
      validatedAt,
      lastCheckedAt: settledAt,
      nextCheckAt: null,
      disqualifiedAt: null,
      disqualificationReason: null,
    },
    create: {
      id: IDS.socialPost,
      draftId: IDS.socialDraft,
      raffleId: sourceRaffleId,
      sellerId,
      network: SocialPromotionNetwork.X,
      submittedPermalink: 'https://x.com/luk/status/promo-qa-grant-fixture',
      canonicalPermalink: 'https://x.com/luk/status/promo-qa-grant-fixture',
      canonicalPostId: 'promo-qa-grant-fixture',
      status: SocialPromotionStatus.SETTLED,
      publishedAt: submittedAt,
      submittedAt,
      validatedAt,
      lastCheckedAt: settledAt,
    },
  });

  await prisma.socialPromotionMetricSnapshot.upsert({
    where: { id: IDS.socialSnapshot },
    update: {
      socialPromotionPostId: IDS.socialPost,
      checkedAt: settledAt,
      isAccessible: true,
      tokenPresent: true,
      likesCount: 140,
      commentsCount: 18,
      repostsOrSharesCount: 11,
      viewsCount: 4200,
      clicksAttributed: 27,
      registrationsAttributed: 4,
      ticketPurchasesAttributed: 6,
      rawEvidenceMeta: {
        permalink: 'https://x.com/luk/status/promo-qa-grant-fixture',
        source: 'canonical-seed',
      },
      parserVersion: 'seed-fixture-v1',
      failureReason: null,
    },
    create: {
      id: IDS.socialSnapshot,
      socialPromotionPostId: IDS.socialPost,
      checkedAt: settledAt,
      isAccessible: true,
      tokenPresent: true,
      likesCount: 140,
      commentsCount: 18,
      repostsOrSharesCount: 11,
      viewsCount: 4200,
      clicksAttributed: 27,
      registrationsAttributed: 4,
      ticketPurchasesAttributed: 6,
      rawEvidenceMeta: {
        permalink: 'https://x.com/luk/status/promo-qa-grant-fixture',
        source: 'canonical-seed',
      },
      parserVersion: 'seed-fixture-v1',
    },
  });

  await prisma.socialPromotionAttributionEvent.upsert({
    where: { id: IDS.socialClickEvent },
    update: {
      socialPromotionPostId: IDS.socialPost,
      eventType: SocialPromotionAttributionEventType.CLICK,
      userId: null,
      ticketCount: null,
      amount: null,
      metadata: { clicksRepresented: 27, source: 'canonical-seed' },
    },
    create: {
      id: IDS.socialClickEvent,
      socialPromotionPostId: IDS.socialPost,
      eventType: SocialPromotionAttributionEventType.CLICK,
      metadata: { clicksRepresented: 27, source: 'canonical-seed' },
    },
  });

  await prisma.socialPromotionAttributionEvent.upsert({
    where: { id: IDS.socialRegistrationEvent },
    update: {
      socialPromotionPostId: IDS.socialPost,
      eventType: SocialPromotionAttributionEventType.REGISTRATION,
      userId: null,
      ticketCount: null,
      amount: null,
      metadata: { registrationsRepresented: 4, source: 'canonical-seed' },
    },
    create: {
      id: IDS.socialRegistrationEvent,
      socialPromotionPostId: IDS.socialPost,
      eventType: SocialPromotionAttributionEventType.REGISTRATION,
      metadata: { registrationsRepresented: 4, source: 'canonical-seed' },
    },
  });

  await prisma.socialPromotionAttributionEvent.upsert({
    where: { id: IDS.socialPurchaseEvent },
    update: {
      socialPromotionPostId: IDS.socialPost,
      eventType: SocialPromotionAttributionEventType.PURCHASE,
      userId: null,
      ticketCount: 6,
      amount: 7500,
      metadata: { source: 'canonical-seed' },
    },
    create: {
      id: IDS.socialPurchaseEvent,
      socialPromotionPostId: IDS.socialPost,
      eventType: SocialPromotionAttributionEventType.PURCHASE,
      ticketCount: 6,
      amount: 7500,
      metadata: { source: 'canonical-seed' },
    },
  });

  await prisma.promotionScoreSettlement.upsert({
    where: { id: IDS.socialSettlement },
    update: {
      socialPromotionPostId: IDS.socialPost,
      sellerId,
      raffleId: sourceRaffleId,
      baseScore: 10,
      engagementScore: 12.95,
      conversionScore: 14.7,
      totalScore: 37.65,
      settlementStatus: SocialPromotionStatus.SETTLED,
      settledAt,
    },
    create: {
      id: IDS.socialSettlement,
      socialPromotionPostId: IDS.socialPost,
      sellerId,
      raffleId: sourceRaffleId,
      baseScore: 10,
      engagementScore: 12.95,
      conversionScore: 14.7,
      totalScore: 37.65,
      settlementStatus: SocialPromotionStatus.SETTLED,
      settledAt,
    },
  });

  await prisma.promotionBonusGrant.upsert({
    where: { id: IDS.socialGrant },
    update: {
      sellerId,
      sourceSettlementId: IDS.socialSettlement,
      discountPercent: 10,
      maxDiscountAmount: 10000,
      expiresAt,
      status: PromotionBonusGrantStatus.AVAILABLE,
      usedAt: null,
    },
    create: {
      id: IDS.socialGrant,
      sellerId,
      sourceSettlementId: IDS.socialSettlement,
      discountPercent: 10,
      maxDiscountAmount: 10000,
      expiresAt,
      status: PromotionBonusGrantStatus.AVAILABLE,
    },
  });

  await prisma.notification.upsert({
    where: { id: `qa_notification_${IDS.socialGrant}` },
    update: {
      userId: sellerId,
      type: 'SOCIAL_PROMOTION_GRANT_ISSUED',
      title: 'Ganaste una bonificación promocional',
      message:
        'Tenés un 10% off hasta $10000 para usar en rifas de otros vendedores. Vence en 30 días.',
      actionUrl: '/dashboard/tickets',
      read: false,
    },
    create: {
      id: `qa_notification_${IDS.socialGrant}`,
      userId: sellerId,
      type: 'SOCIAL_PROMOTION_GRANT_ISSUED',
      title: 'Ganaste una bonificación promocional',
      message: `Hola ${sellerName}. Tu post promocional de ${sellerEmail} generó un grant del 10% off hasta $10000. Revisalo en Tus tickets.`,
      actionUrl: '/dashboard/tickets',
    },
  });
}

async function main() {
  console.log('🌱 Running canonical QA/dev seed...');

  const [userHash, adminHash] = await Promise.all([
    bcrypt.hash(DEFAULT_PASSWORD, 10),
    bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10),
  ]);

  const seller = await upsertUser({
    email: USERS.seller,
    nombre: 'Vendedor',
    apellido: 'Test',
    passwordHash: userHash,
    kycStatus: KycStatus.VERIFIED,
    kycVerifiedAt: daysAgo(45),
    mpConnectStatus: MpConnectStatus.CONNECTED,
    mpUserId: 'qa_mp_seller_001',
    mpAccessToken: 'qa_mock_access_token_seller',
    documentType: DocumentType.DNI,
    documentNumber: '30111222',
    createdAt: daysAgo(70),
  });

  const buyer = await upsertUser({
    email: USERS.buyer,
    nombre: 'Comprador',
    apellido: 'Test',
    passwordHash: userHash,
    kycStatus: KycStatus.VERIFIED,
    kycVerifiedAt: daysAgo(35),
    documentType: DocumentType.DNI,
    documentNumber: '33444555',
    createdAt: daysAgo(45),
  });

  const other = await upsertUser({
    email: USERS.other,
    nombre: 'Otro',
    apellido: 'Seller',
    passwordHash: userHash,
    kycStatus: KycStatus.VERIFIED,
    kycVerifiedAt: daysAgo(30),
    mpConnectStatus: MpConnectStatus.CONNECTED,
    mpUserId: 'qa_mp_other_001',
    mpAccessToken: 'qa_mock_access_token_other',
    documentType: DocumentType.DNI,
    documentNumber: '32111999',
    createdAt: daysAgo(50),
  });

  await upsertUser({
    email: USERS.admin,
    nombre: 'Admin',
    apellido: 'Test',
    passwordHash: adminHash,
    role: UserRole.ADMIN,
    kycStatus: KycStatus.VERIFIED,
    kycVerifiedAt: daysAgo(60),
    createdAt: daysAgo(90),
  });

  await upsertUser({
    email: USERS.unverifiedKyc,
    nombre: 'Unverified',
    apellido: 'Seller',
    passwordHash: userHash,
    kycStatus: KycStatus.NOT_SUBMITTED,
  });

  await upsertUser({
    email: USERS.pendingKyc,
    nombre: 'Pending',
    apellido: 'KYC',
    passwordHash: userHash,
    kycStatus: KycStatus.PENDING_REVIEW,
    kycSubmittedAt: daysAgo(2),
    documentType: DocumentType.DNI,
    documentNumber: '33445566',
  });

  await upsertUser({
    email: USERS.rejectedKyc,
    nombre: 'Rejected',
    apellido: 'KYC',
    passwordHash: userHash,
    kycStatus: KycStatus.REJECTED,
    kycSubmittedAt: daysAgo(5),
    kycRejectedReason:
      'Documento ilegible. Por favor, volvé a subir las fotos con mejor iluminación.',
    documentType: DocumentType.DNI,
    documentNumber: '35556677',
  });

  const sellerPro = await upsertUser({
    email: USERS.sellerPro,
    nombre: 'Sofía',
    apellido: 'Premium',
    passwordHash: userHash,
    kycStatus: KycStatus.VERIFIED,
    kycVerifiedAt: daysAgo(120),
    mpConnectStatus: MpConnectStatus.CONNECTED,
    mpUserId: 'qa_mp_seller_pro_001',
    mpAccessToken: 'qa_mock_access_token_seller_pro',
    documentType: DocumentType.DNI,
    documentNumber: '28888001',
    createdAt: daysAgo(160),
  });

  const sellerGrowth = await upsertUser({
    email: USERS.sellerGrowth,
    nombre: 'Martín',
    apellido: 'Growth',
    passwordHash: userHash,
    kycStatus: KycStatus.VERIFIED,
    kycVerifiedAt: daysAgo(75),
    mpConnectStatus: MpConnectStatus.CONNECTED,
    mpUserId: 'qa_mp_seller_growth_001',
    mpAccessToken: 'qa_mock_access_token_seller_growth',
    documentType: DocumentType.DNI,
    documentNumber: '29999002',
    createdAt: daysAgo(110),
  });

  const sellerNoMp = await upsertUser({
    email: USERS.sellerNoMp,
    nombre: 'Lucía',
    apellido: 'Sin MP',
    passwordHash: userHash,
    kycStatus: KycStatus.VERIFIED,
    kycVerifiedAt: daysAgo(28),
    documentType: DocumentType.DNI,
    documentNumber: '27777003',
    createdAt: daysAgo(35),
  });

  const sellerNoAddress = await upsertUser({
    email: USERS.sellerNoAddress,
    nombre: 'Diego',
    apellido: 'Sin Dirección',
    passwordHash: userHash,
    kycStatus: KycStatus.VERIFIED,
    kycVerifiedAt: daysAgo(40),
    mpConnectStatus: MpConnectStatus.CONNECTED,
    mpUserId: 'qa_mp_seller_no_addr_001',
    mpAccessToken: 'qa_mock_access_token_seller_no_addr',
    documentType: DocumentType.DNI,
    documentNumber: '26666004',
    createdAt: daysAgo(55),
  });

  const sellerPendingMp = await upsertUser({
    email: USERS.sellerPendingMp,
    nombre: 'Valentina',
    apellido: 'MP Pending',
    passwordHash: userHash,
    kycStatus: KycStatus.VERIFIED,
    kycVerifiedAt: daysAgo(18),
    mpConnectStatus: MpConnectStatus.PENDING,
    documentType: DocumentType.DNI,
    documentNumber: '25555005',
    createdAt: daysAgo(30),
  });

  const buyerHeavy = await upsertUser({
    email: USERS.buyerHeavy,
    nombre: 'Buyer',
    apellido: 'Heavy',
    passwordHash: userHash,
    kycStatus: KycStatus.VERIFIED,
    kycVerifiedAt: daysAgo(90),
    documentType: DocumentType.DNI,
    documentNumber: '34444006',
    createdAt: daysAgo(120),
  });

  const buyerWinner = await upsertUser({
    email: USERS.buyerWinner,
    nombre: 'Buyer',
    apellido: 'Winner',
    passwordHash: userHash,
    kycStatus: KycStatus.VERIFIED,
    kycVerifiedAt: daysAgo(55),
    documentType: DocumentType.DNI,
    documentNumber: '33333007',
    createdAt: daysAgo(75),
  });

  const buyerRefund = await upsertUser({
    email: USERS.buyerRefund,
    nombre: 'Buyer',
    apellido: 'Refund',
    passwordHash: userHash,
    kycStatus: KycStatus.VERIFIED,
    kycVerifiedAt: daysAgo(30),
    documentType: DocumentType.DNI,
    documentNumber: '32222008',
    createdAt: daysAgo(45),
  });

  const buyerDispute = await upsertUser({
    email: USERS.buyerDispute,
    nombre: 'Buyer',
    apellido: 'Dispute',
    passwordHash: userHash,
    kycStatus: KycStatus.VERIFIED,
    kycVerifiedAt: daysAgo(44),
    documentType: DocumentType.DNI,
    documentNumber: '31111009',
    createdAt: daysAgo(65),
  });

  const buyerNew = await upsertUser({
    email: USERS.buyerNew,
    nombre: 'Buyer',
    apellido: 'Nuevo',
    passwordHash: userHash,
    kycStatus: KycStatus.VERIFIED,
    kycVerifiedAt: daysAgo(3),
    documentType: DocumentType.DNI,
    documentNumber: '30000010',
    createdAt: daysAgo(25),
  });

  const buyerPromo = await upsertUser({
    email: USERS.buyerPromo,
    nombre: 'Buyer',
    apellido: 'Promo',
    passwordHash: userHash,
    kycStatus: KycStatus.VERIFIED,
    kycVerifiedAt: daysAgo(22),
    documentType: DocumentType.DNI,
    documentNumber: '39999011',
    createdAt: daysAgo(36),
  });

  const buyerPack = await upsertUser({
    email: USERS.buyerPack,
    nombre: 'Buyer',
    apellido: 'Pack',
    passwordHash: userHash,
    kycStatus: KycStatus.VERIFIED,
    kycVerifiedAt: daysAgo(14),
    documentType: DocumentType.DNI,
    documentNumber: '38888012',
    createdAt: daysAgo(28),
  });

  const googleOnly = await upsertUser({
    email: USERS.googleOnly,
    nombre: 'Google',
    apellido: 'Only',
    passwordHash: null,
    emailVerified: true,
    googleId: 'qa_google_only_001',
    avatarUrl: 'https://picsum.photos/seed/qa-google-only/200/200',
    createdAt: daysAgo(40),
  });

  const unverifiedEmailUser = await upsertUser({
    email: USERS.unverifiedEmail,
    nombre: 'Email',
    apellido: 'Pendiente',
    passwordHash: userHash,
    emailVerified: false,
    kycStatus: KycStatus.NOT_SUBMITTED,
    createdAt: daysAgo(1),
  });

  const bannedUser = await upsertUser({
    email: USERS.banned,
    nombre: 'Usuario',
    apellido: 'Baneado',
    passwordHash: userHash,
    role: UserRole.BANNED,
    kycStatus: KycStatus.VERIFIED,
    kycVerifiedAt: daysAgo(12),
    createdAt: daysAgo(30),
  });

  const adminOps = await upsertUser({
    email: USERS.adminOps,
    nombre: 'Admin',
    apellido: 'Operaciones',
    passwordHash: adminHash,
    role: UserRole.ADMIN,
    kycStatus: KycStatus.VERIFIED,
    kycVerifiedAt: daysAgo(90),
    createdAt: daysAgo(120),
  });

  await upsertAddress({
    id: IDS.sellerAddress,
    userId: seller.id,
    label: 'Depósito principal',
    recipientName: 'Vendedor Test',
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
    label: 'Casa',
    recipientName: 'Comprador Test',
    street: 'Calle Buyer',
    number: '200',
    city: 'Buenos Aires',
    province: 'CABA',
    postalCode: '1001',
    isDefault: true,
  });

  await upsertAddress({
    id: IDS.otherAddress,
    userId: other.id,
    label: 'Depósito secundario',
    recipientName: 'Otro Seller',
    street: 'Calle Other',
    number: '300',
    city: 'Buenos Aires',
    province: 'CABA',
    postalCode: '1002',
    isDefault: true,
  });

  await upsertAddress({
    id: addressId('seller_pro'),
    userId: sellerPro.id,
    label: 'Showroom premium',
    recipientName: 'Sofía Premium',
    street: 'Av. Libertador',
    number: '1800',
    city: 'Buenos Aires',
    province: 'CABA',
    postalCode: '1425',
    isDefault: true,
  });

  await upsertAddress({
    id: addressId('seller_growth'),
    userId: sellerGrowth.id,
    label: 'Depósito growth',
    recipientName: 'Martín Growth',
    street: 'Av. Corrientes',
    number: '2200',
    city: 'Buenos Aires',
    province: 'CABA',
    postalCode: '1046',
    isDefault: true,
  });

  await upsertAddress({
    id: addressId('seller_no_mp'),
    userId: sellerNoMp.id,
    label: 'Casa',
    recipientName: 'Lucía Sin MP',
    street: 'Calle Comercio',
    number: '915',
    city: 'Rosario',
    province: 'Santa Fe',
    postalCode: '2000',
    isDefault: true,
  });

  await upsertAddress({
    id: addressId('seller_pending_mp'),
    userId: sellerPendingMp.id,
    label: 'Taller',
    recipientName: 'Valentina MP Pending',
    street: 'Av. Colón',
    number: '410',
    city: 'Córdoba',
    province: 'Córdoba',
    postalCode: '5000',
    isDefault: true,
  });

  await upsertAddress({
    id: addressId('buyer_heavy'),
    userId: buyerHeavy.id,
    label: 'Casa',
    recipientName: 'Buyer Heavy',
    street: 'Calle Tickets',
    number: '101',
    city: 'La Plata',
    province: 'Buenos Aires',
    postalCode: '1900',
    isDefault: true,
  });

  await upsertAddress({
    id: addressId('buyer_winner'),
    userId: buyerWinner.id,
    label: 'Departamento',
    recipientName: 'Buyer Winner',
    street: 'Calle Ganador',
    number: '77',
    city: 'Mendoza',
    province: 'Mendoza',
    postalCode: '5500',
    isDefault: true,
  });

  await upsertAddress({
    id: addressId('buyer_refund'),
    userId: buyerRefund.id,
    label: 'Casa',
    recipientName: 'Buyer Refund',
    street: 'Calle Reembolso',
    number: '58',
    city: 'Mar del Plata',
    province: 'Buenos Aires',
    postalCode: '7600',
    isDefault: true,
  });

  await upsertAddress({
    id: addressId('buyer_dispute'),
    userId: buyerDispute.id,
    label: 'Oficina',
    recipientName: 'Buyer Dispute',
    street: 'Calle Mediación',
    number: '310',
    city: 'San Miguel de Tucumán',
    province: 'Tucumán',
    postalCode: '4000',
    isDefault: true,
  });

  await upsertAddress({
    id: addressId('buyer_new'),
    userId: buyerNew.id,
    label: 'Casa',
    recipientName: 'Buyer Nuevo',
    street: 'Calle Inicio',
    number: '12',
    city: 'Neuquén',
    province: 'Neuquén',
    postalCode: '8300',
    isDefault: true,
  });

  await upsertAddress({
    id: addressId('buyer_promo'),
    userId: buyerPromo.id,
    label: 'Casa',
    recipientName: 'Buyer Promo',
    street: 'Calle Bonus',
    number: '555',
    city: 'Salta',
    province: 'Salta',
    postalCode: '4400',
    isDefault: true,
  });

  await upsertAddress({
    id: addressId('buyer_pack'),
    userId: buyerPack.id,
    label: 'Casa',
    recipientName: 'Buyer Pack',
    street: 'Calle Pack',
    number: '222',
    city: 'Bahía Blanca',
    province: 'Buenos Aires',
    postalCode: '8000',
    isDefault: true,
  });

  await upsertAddress({
    id: addressId('google_only'),
    userId: googleOnly.id,
    label: 'Casa',
    recipientName: 'Google Only',
    street: 'Calle OAuth',
    number: '900',
    city: 'Buenos Aires',
    province: 'CABA',
    postalCode: '1414',
    isDefault: true,
  });

  await prisma.user.update({
    where: { id: seller.id },
    data: { defaultSenderAddressId: IDS.sellerAddress },
  });

  await prisma.user.update({
    where: { id: other.id },
    data: { defaultSenderAddressId: IDS.otherAddress },
  });

  await prisma.user.update({
    where: { id: sellerPro.id },
    data: { defaultSenderAddressId: addressId('seller_pro') },
  });

  await prisma.user.update({
    where: { id: sellerGrowth.id },
    data: { defaultSenderAddressId: addressId('seller_growth') },
  });

  await prisma.user.update({
    where: { id: sellerNoMp.id },
    data: { defaultSenderAddressId: addressId('seller_no_mp') },
  });

  await prisma.user.update({
    where: { id: sellerPendingMp.id },
    data: { defaultSenderAddressId: addressId('seller_pending_mp') },
  });

  await Promise.all([
    upsertUserReputation({
      userId: seller.id,
      maxRifasSimultaneas: 3,
      nivelVendedor: SellerLevel.NUEVO,
      totalVentasCompletadas: 2,
      disputasComoVendedorGanadas: 0,
      disputasComoVendedorPerdidas: 2,
      ratingPromedioVendedor: 3.2,
    }),
    upsertUserReputation({
      userId: buyer.id,
      totalComprasCompletadas: 6,
      totalTicketsComprados: 18,
    }),
    upsertUserReputation({
      userId: other.id,
      totalVentasCompletadas: 3,
      nivelVendedor: SellerLevel.BRONCE,
      ratingPromedioVendedor: 4.4,
    }),
    upsertUserReputation({
      userId: sellerPro.id,
      maxRifasSimultaneas: 10,
      nivelVendedor: SellerLevel.ORO,
      totalVentasCompletadas: 58,
      disputasComoVendedorGanadas: 5,
      disputasComoVendedorPerdidas: 1,
      ratingPromedioVendedor: 4.9,
    }),
    upsertUserReputation({
      userId: sellerGrowth.id,
      maxRifasSimultaneas: 7,
      nivelVendedor: SellerLevel.PLATA,
      totalVentasCompletadas: 24,
      disputasComoVendedorGanadas: 2,
      ratingPromedioVendedor: 4.6,
    }),
    upsertUserReputation({
      userId: sellerNoMp.id,
      maxRifasSimultaneas: 3,
      nivelVendedor: SellerLevel.BRONCE,
      totalVentasCompletadas: 4,
      ratingPromedioVendedor: 4.1,
    }),
    upsertUserReputation({
      userId: sellerNoAddress.id,
      maxRifasSimultaneas: 4,
      nivelVendedor: SellerLevel.BRONCE,
      totalVentasCompletadas: 7,
      ratingPromedioVendedor: 4.3,
    }),
    upsertUserReputation({
      userId: sellerPendingMp.id,
      maxRifasSimultaneas: 3,
      nivelVendedor: SellerLevel.NUEVO,
      totalVentasCompletadas: 1,
      ratingPromedioVendedor: 3.8,
    }),
    upsertUserReputation({
      userId: buyerHeavy.id,
      totalComprasCompletadas: 28,
      totalTicketsComprados: 91,
    }),
    upsertUserReputation({
      userId: buyerWinner.id,
      totalComprasCompletadas: 12,
      totalTicketsComprados: 34,
      totalRifasGanadas: 3,
    }),
    upsertUserReputation({
      userId: buyerRefund.id,
      totalComprasCompletadas: 9,
      totalTicketsComprados: 21,
    }),
    upsertUserReputation({
      userId: buyerDispute.id,
      totalComprasCompletadas: 3,
      totalTicketsComprados: 26,
      disputasComoCompradorAbiertas: 2,
    }),
    upsertUserReputation({
      userId: buyerNew.id,
      totalComprasCompletadas: 0,
      totalTicketsComprados: 1,
      disputasComoCompradorAbiertas: 1,
    }),
    upsertUserReputation({
      userId: buyerPromo.id,
      totalComprasCompletadas: 8,
      totalTicketsComprados: 19,
    }),
    upsertUserReputation({
      userId: buyerPack.id,
      totalComprasCompletadas: 5,
      totalTicketsComprados: 24,
    }),
    upsertUserReputation({
      userId: googleOnly.id,
      totalComprasCompletadas: 2,
      totalTicketsComprados: 4,
    }),
  ]);

  const categories = await upsertCategories();
  const electronicsCategoryId = categories.get('Electronica') ?? null;
  const fashionCategoryId = categories.get('Moda') ?? null;
  const homeCategoryId = categories.get('Hogar') ?? null;
  const sportsCategoryId = categories.get('Deportes') ?? null;
  const entertainmentCategoryId = categories.get('Entretenimiento') ?? null;

  await upsertRaffle({
    id: IDS.raffleActive,
    sellerId: seller.id,
    categoryId: electronicsCategoryId,
    title: `${QA_PREFIX} iPhone 15 Pro - Activa`,
    description:
      'Rifa activa visible para pruebas de búsqueda, compra y favoritos.',
    totalTickets: 20,
    price: 1500,
    deadline: daysFromNow(10),
    status: RaffleStatus.ACTIVA,
  });
  await deleteDrawResultIfAny(IDS.raffleActive);
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

  await upsertRaffle({
    id: IDS.raffleHidden,
    sellerId: seller.id,
    categoryId: electronicsCategoryId,
    title: `${QA_PREFIX} Oculta`,
    description: 'Rifa oculta para pruebas de visibilidad y moderación.',
    totalTickets: 10,
    price: 900,
    deadline: daysFromNow(15),
    status: RaffleStatus.FINALIZADA,
    deliveryStatus: DeliveryStatus.CONFIRMED,
    isHidden: true,
    paymentReleasedAt: daysAgo(5),
  });
  await deleteDrawResultIfAny(IDS.raffleHidden);

  await upsertRaffle({
    id: IDS.raffleDeleted,
    sellerId: seller.id,
    categoryId: electronicsCategoryId,
    title: `${QA_PREFIX} Eliminada`,
    description: 'Rifa soft-deleted para validar exclusión en listados.',
    totalTickets: 10,
    price: 800,
    deadline: daysFromNow(7),
    status: RaffleStatus.CANCELADA,
    isDeleted: true,
  });
  await deleteDrawResultIfAny(IDS.raffleDeleted);

  await upsertRaffle({
    id: IDS.raffleCompletedNoDraw,
    sellerId: seller.id,
    categoryId: electronicsCategoryId,
    title: `${QA_PREFIX} Completa sin sorteo`,
    description:
      'Rifa vendida al 100% en COMPLETADA sin winner para probar auto-draw.',
    totalTickets: 5,
    price: 700,
    deadline: daysAgo(1),
    status: RaffleStatus.COMPLETADA,
  });
  await deleteDrawResultIfAny(IDS.raffleCompletedNoDraw);
  for (let number = 1; number <= 5; number++) {
    await upsertTicket({
      raffleId: IDS.raffleCompletedNoDraw,
      number,
      buyerId: number <= 3 ? buyer.id : other.id,
      status: TicketStatus.PAGADO,
      price: 700,
      mpPaymentId: `qa_mp_completed_${number}`,
      purchasedAt: daysAgo(2),
    });
  }

  await upsertRaffle({
    id: IDS.raffleSorteadaPending,
    sellerId: seller.id,
    categoryId: electronicsCategoryId,
    title: `${QA_PREFIX} Sorteada pendiente envío`,
    description:
      'Ganador definido, sin envío para probar bloqueo de confirmación.',
    totalTickets: 6,
    price: 1200,
    deadline: daysAgo(3),
    status: RaffleStatus.SORTEADA,
    winnerId: buyer.id,
    drawDate: daysAgo(2),
  });
  for (let number = 1; number <= 3; number++) {
    await upsertTicket({
      raffleId: IDS.raffleSorteadaPending,
      number,
      buyerId: number === 1 ? buyer.id : other.id,
      status: TicketStatus.PAGADO,
      price: 1200,
      mpPaymentId: `qa_mp_pending_ship_${number}`,
      purchasedAt: daysAgo(3),
    });
  }
  await upsertDrawResult({
    raffleId: IDS.raffleSorteadaPending,
    winningTicketId: ticketId(IDS.raffleSorteadaPending, 1),
    winnerId: buyer.id,
    participants: 3,
  });

  await upsertRaffle({
    id: IDS.raffleShipped,
    sellerId: seller.id,
    categoryId: electronicsCategoryId,
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
  for (let number = 1; number <= 3; number++) {
    await upsertTicket({
      raffleId: IDS.raffleShipped,
      number,
      buyerId: number === 1 ? buyer.id : other.id,
      status: TicketStatus.PAGADO,
      price: 1300,
      mpPaymentId: `qa_mp_shipped_${number}`,
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

  await upsertRaffle({
    id: IDS.raffleFinalizedPayout,
    sellerId: seller.id,
    categoryId: electronicsCategoryId,
    title: `${QA_PREFIX} Finalizada con payout`,
    description: 'Caso finalizado para probar historial de payouts y grants.',
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
  for (let number = 1; number <= 3; number++) {
    await upsertTicket({
      raffleId: IDS.raffleFinalizedPayout,
      number,
      buyerId: number === 1 ? buyer.id : other.id,
      status: TicketStatus.PAGADO,
      price: 1600,
      mpPaymentId: `qa_mp_final_${number}`,
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

  await upsertRaffle({
    id: IDS.raffleCancelledRelaunch,
    sellerId: seller.id,
    categoryId: electronicsCategoryId,
    title: `${QA_PREFIX} Cancelada para relanzar`,
    description: 'Escenario de relanzamiento con precio sugerido.',
    totalTickets: 20,
    price: 1000,
    deadline: daysAgo(4),
    status: RaffleStatus.CANCELADA,
  });
  await deleteDrawResultIfAny(IDS.raffleCancelledRelaunch);
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

  await upsertRaffle({
    id: IDS.raffleExpiredLowSale,
    sellerId: seller.id,
    categoryId: electronicsCategoryId,
    title: `${QA_PREFIX} Expirada bajo 70%`,
    description:
      'Escenario para cancelación y reembolso por bajo porcentaje vendido.',
    totalTickets: 10,
    price: 500,
    deadline: daysAgo(2),
    status: RaffleStatus.ACTIVA,
  });
  await deleteDrawResultIfAny(IDS.raffleExpiredLowSale);
  for (let number = 1; number <= 4; number++) {
    await upsertTicket({
      raffleId: IDS.raffleExpiredLowSale,
      number,
      buyerId: number <= 2 ? buyer.id : other.id,
      status: TicketStatus.PAGADO,
      price: 500,
      mpPaymentId: `qa_mp_low_sale_${number}`,
      purchasedAt: daysAgo(3),
    });
  }

  await upsertRaffle({
    id: IDS.raffleBonusTargetOther,
    sellerId: other.id,
    categoryId: electronicsCategoryId,
    title: `${QA_PREFIX} Destino para bonus grant`,
    description:
      'Rifa activa de otro seller para probar redención del grant promocional.',
    totalTickets: 25,
    price: 1250,
    deadline: daysFromNow(12),
    status: RaffleStatus.ACTIVA,
  });
  await deleteDrawResultIfAny(IDS.raffleBonusTargetOther);

  await upsertRaffle({
    id: IDS.raffleDisputeOpen,
    sellerId: seller.id,
    categoryId: electronicsCategoryId,
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
    title: `${QA_PREFIX} No llegó el premio`,
    description:
      'Disputa abierta de QA para validar paneles de comprador, vendedor y admin.',
    buyerEvidence: ['https://picsum.photos/seed/qa-dispute-open-buyer/600/400'],
    createdAt: daysAgo(2),
  });

  await upsertRaffle({
    id: IDS.raffleDisputeMediation,
    sellerId: seller.id,
    categoryId: electronicsCategoryId,
    title: `${QA_PREFIX} Disputa en mediación`,
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
    buyerEvidence: [
      'https://picsum.photos/seed/qa-dispute-mediated-buyer/600/400',
    ],
    createdAt: daysAgo(5),
    sellerResponse: 'Respondimos con pruebas de envío y detalles del producto.',
    sellerEvidence: ['https://picsum.photos/seed/canonical-seller/600/400'],
    respondedAt: daysAgo(4),
  });

  await upsertRaffle({
    id: IDS.raffleDisputeOld,
    sellerId: seller.id,
    categoryId: electronicsCategoryId,
    title: `${QA_PREFIX} Disputa antigua`,
    description:
      'Rifa con disputa antigua de comprador nuevo para cron de auto-resolución.',
    totalTickets: 5,
    price: 1000,
    deadline: daysAgo(25),
    status: RaffleStatus.SORTEADA,
    deliveryStatus: DeliveryStatus.DISPUTED,
    winnerId: buyerNew.id,
    drawDate: daysAgo(24),
  });
  await upsertTicket({
    raffleId: IDS.raffleDisputeOld,
    number: 1,
    buyerId: buyerNew.id,
    status: TicketStatus.PAGADO,
    price: 1000,
    mpPaymentId: 'qa_mp_dispute_old_1',
    purchasedAt: daysAgo(24),
  });
  await upsertDrawResult({
    raffleId: IDS.raffleDisputeOld,
    winningTicketId: ticketId(IDS.raffleDisputeOld, 1),
    winnerId: buyerNew.id,
    participants: 1,
  });
  await upsertDispute({
    raffleId: IDS.raffleDisputeOld,
    reporterId: buyerNew.id,
    type: DisputeType.VENDEDOR_NO_RESPONDE,
    status: DisputeStatus.ESPERANDO_RESPUESTA_VENDEDOR,
    title: `${QA_PREFIX} Sin respuesta vendedor`,
    description:
      'Comprador nuevo abrió una disputa antigua para verificar auto-refund por cron si supera 15 días.',
    buyerEvidence: ['https://picsum.photos/seed/qa-dispute-new-buyer/600/400'],
    createdAt: daysAgo(20),
  });

  await upsertRaffle({
    id: IDS.raffleDisputeResolvedBuyer,
    sellerId: seller.id,
    categoryId: electronicsCategoryId,
    title: `${QA_PREFIX} Disputa resuelta comprador`,
    description: 'Rifa con disputa RESUELTA_COMPRADOR.',
    totalTickets: 5,
    price: 1100,
    deadline: daysAgo(14),
    status: RaffleStatus.FINALIZADA,
    deliveryStatus: DeliveryStatus.DISPUTED,
    winnerId: buyer.id,
    drawDate: daysAgo(13),
  });
  await upsertTicket({
    raffleId: IDS.raffleDisputeResolvedBuyer,
    number: 1,
    buyerId: buyer.id,
    status: TicketStatus.PAGADO,
    price: 1100,
    mpPaymentId: 'qa_mp_dispute_resolved_1',
    purchasedAt: daysAgo(14),
  });
  await upsertDrawResult({
    raffleId: IDS.raffleDisputeResolvedBuyer,
    winningTicketId: ticketId(IDS.raffleDisputeResolvedBuyer, 1),
    winnerId: buyer.id,
    participants: 1,
  });
  await upsertDispute({
    raffleId: IDS.raffleDisputeResolvedBuyer,
    reporterId: buyer.id,
    type: DisputeType.NO_LLEGO,
    status: DisputeStatus.RESUELTA_COMPRADOR,
    title: `${QA_PREFIX} Resuelta a favor del comprador`,
    description:
      'Caso resuelto para probar vistas históricas y estados finales de disputa.',
    buyerEvidence: [
      'https://picsum.photos/seed/qa-dispute-resolved-buyer/600/400',
    ],
    createdAt: daysAgo(9),
    sellerResponse:
      'El paquete salió del depósito pero no tenemos tracking válido para presentarlo.',
    sellerEvidence: [
      'https://picsum.photos/seed/canonical-seller-final/600/400',
    ],
    respondedAt: daysAgo(8),
    resolution:
      'Se verificó falta de evidencia suficiente del envío. Corresponde reembolso total.',
    refundAmount: 1100,
    sellerAmount: 0,
    adminNotes: 'Fixture QA de disputa resuelta a favor del comprador.',
    resolvedAt: daysAgo(7),
  });

  await upsertRaffle({
    id: IDS.rafflePackFive,
    sellerId: sellerGrowth.id,
    categoryId: electronicsCategoryId,
    title: `${QA_PREFIX} Pack 5 activo`,
    description: 'Rifa activa ideal para probar el pack simple 5 -> 6.',
    totalTickets: 18,
    price: 2100,
    deadline: daysFromNow(9),
    status: RaffleStatus.ACTIVA,
    viewCount: 48,
  });
  await deleteDrawResultIfAny(IDS.rafflePackFive);
  await upsertTicket({
    raffleId: IDS.rafflePackFive,
    number: 1,
    buyerId: buyer.id,
    status: TicketStatus.PAGADO,
    price: 2100,
    mpPaymentId: 'qa_mp_pack_five_1',
    purchasedAt: daysAgo(1),
  });
  await upsertTicket({
    raffleId: IDS.rafflePackFive,
    number: 2,
    buyerId: other.id,
    status: TicketStatus.PAGADO,
    price: 2100,
    mpPaymentId: 'qa_mp_pack_five_2',
    purchasedAt: daysAgo(1),
  });

  await upsertRaffle({
    id: IDS.rafflePackTen,
    sellerId: sellerPro.id,
    categoryId: electronicsCategoryId,
    title: `${QA_PREFIX} Pack 10 activo`,
    description: 'Rifa activa ideal para probar el pack simple 10 -> 12.',
    totalTickets: 30,
    price: 950,
    deadline: daysFromNow(14),
    status: RaffleStatus.ACTIVA,
    viewCount: 71,
  });
  await deleteDrawResultIfAny(IDS.rafflePackTen);
  for (let number = 1; number <= 3; number++) {
    await upsertTicket({
      raffleId: IDS.rafflePackTen,
      number,
      buyerId: number === 1 ? buyerPack.id : other.id,
      status: TicketStatus.PAGADO,
      price: 950,
      mpPaymentId: `qa_mp_pack_ten_${number}`,
      purchasedAt: daysAgo(2),
    });
  }

  await upsertRaffle({
    id: IDS.rafflePackLowStock,
    sellerId: sellerGrowth.id,
    categoryId: electronicsCategoryId,
    title: `${QA_PREFIX} Pack fallback por stock`,
    description:
      'Caso para validar que el pack degrade a compra normal cuando quedan pocos tickets.',
    totalTickets: 10,
    price: 1750,
    deadline: daysFromNow(5),
    status: RaffleStatus.ACTIVA,
    viewCount: 39,
  });
  await deleteDrawResultIfAny(IDS.rafflePackLowStock);
  for (let number = 1; number <= 5; number++) {
    await upsertTicket({
      raffleId: IDS.rafflePackLowStock,
      number,
      buyerId: number <= 3 ? buyerRefund.id : other.id,
      status: TicketStatus.PAGADO,
      price: 1750,
      mpPaymentId: `qa_mp_pack_low_stock_${number}`,
      purchasedAt: daysAgo(1),
    });
  }

  await upsertRaffle({
    id: IDS.rafflePackBuyerLimit,
    sellerId: sellerPro.id,
    categoryId: electronicsCategoryId,
    title: `${QA_PREFIX} Pack fallback por límite`,
    description:
      'Caso para validar que el pack degrade a compra normal cuando el bonus excedería el 50% permitido.',
    totalTickets: 20,
    price: 1450,
    deadline: daysFromNow(8),
    status: RaffleStatus.ACTIVA,
    viewCount: 67,
  });
  await deleteDrawResultIfAny(IDS.rafflePackBuyerLimit);
  for (let number = 1; number <= 8; number++) {
    await upsertTicket({
      raffleId: IDS.rafflePackBuyerLimit,
      number,
      buyerId: number <= 5 ? buyerHeavy.id : other.id,
      status: TicketStatus.PAGADO,
      price: 1450,
      mpPaymentId: `qa_mp_pack_limit_${number}`,
      purchasedAt: daysAgo(2),
    });
  }

  await upsertRaffle({
    id: IDS.raffleChooseNumbers,
    sellerId: sellerPro.id,
    categoryId: electronicsCategoryId,
    title: `${QA_PREFIX} Elegir números premium`,
    description:
      'Rifa activa para QA del flujo elegir números con premium y números ya ocupados.',
    totalTickets: 50,
    price: 700,
    deadline: daysFromNow(16),
    status: RaffleStatus.ACTIVA,
    viewCount: 122,
  });
  await deleteDrawResultIfAny(IDS.raffleChooseNumbers);
  for (const number of [2, 7, 15, 18, 27]) {
    await upsertTicket({
      raffleId: IDS.raffleChooseNumbers,
      number,
      buyerId: number % 2 === 0 ? buyer.id : other.id,
      status: TicketStatus.PAGADO,
      price: 700,
      mpPaymentId: `qa_mp_choose_numbers_${number}`,
      purchasedAt: daysAgo(3),
    });
  }
  await upsertTicket({
    raffleId: IDS.raffleChooseNumbers,
    number: 41,
    buyerId: buyerRefund.id,
    status: TicketStatus.REEMBOLSADO,
    price: 700,
    mpPaymentId: 'qa_mp_choose_numbers_refunded',
    purchasedAt: daysAgo(4),
  });

  await upsertRaffle({
    id: IDS.rafflePriceDropActive,
    sellerId: sellerGrowth.id,
    categoryId: electronicsCategoryId,
    title: `${QA_PREFIX} Precio rebajado activa`,
    description:
      'Rifa activa con historial de precio y favoritos para QA de alertas.',
    totalTickets: 40,
    price: 1800,
    deadline: daysFromNow(6),
    status: RaffleStatus.ACTIVA,
    viewCount: 260,
    lastPriceDropAt: hoursAgo(18),
  });
  await deleteDrawResultIfAny(IDS.rafflePriceDropActive);
  for (let number = 1; number <= 10; number++) {
    await upsertTicket({
      raffleId: IDS.rafflePriceDropActive,
      number,
      buyerId:
        number <= 4 ? buyerHeavy.id : number <= 7 ? buyerPromo.id : buyer.id,
      status: TicketStatus.PAGADO,
      price: 1800,
      mpPaymentId: `qa_mp_price_drop_${number}`,
      purchasedAt: daysAgo(4),
    });
  }

  await upsertRaffle({
    id: IDS.raffleAlmostSold,
    sellerId: sellerPro.id,
    categoryId: entertainmentCategoryId,
    title: `${QA_PREFIX} Casi agotada`,
    description:
      'Rifa activa casi agotada para QA de urgencia visual y stock restante.',
    totalTickets: 15,
    price: 560,
    deadline: daysFromNow(2),
    status: RaffleStatus.ACTIVA,
    viewCount: 304,
  });
  await deleteDrawResultIfAny(IDS.raffleAlmostSold);
  for (let number = 1; number <= 13; number++) {
    await upsertTicket({
      raffleId: IDS.raffleAlmostSold,
      number,
      buyerId:
        number <= 5
          ? buyerHeavy.id
          : number <= 9
            ? buyerPromo.id
            : buyerPack.id,
      status: TicketStatus.PAGADO,
      price: 560,
      mpPaymentId: `qa_mp_almost_sold_${number}`,
      purchasedAt: daysAgo(1),
    });
  }

  await upsertRaffle({
    id: IDS.raffleNewLaunch,
    sellerId: sellerGrowth.id,
    categoryId: homeCategoryId,
    title: `${QA_PREFIX} Lanzamiento sin ventas`,
    description: 'Rifa recién publicada para QA de estados vacíos.',
    totalTickets: 60,
    price: 490,
    deadline: daysFromNow(20),
    status: RaffleStatus.ACTIVA,
    viewCount: 15,
  });
  await deleteDrawResultIfAny(IDS.raffleNewLaunch);

  await upsertRaffle({
    id: IDS.raffleHomeActive,
    sellerId: sellerPro.id,
    categoryId: homeCategoryId,
    title: `${QA_PREFIX} Cafetera premium`,
    description: 'Rifa activa de hogar para poblar búsqueda y cards.',
    totalTickets: 35,
    price: 980,
    deadline: daysFromNow(11),
    status: RaffleStatus.ACTIVA,
    viewCount: 97,
    productCategory: 'Hogar',
  });
  await deleteDrawResultIfAny(IDS.raffleHomeActive);
  for (let number = 1; number <= 6; number++) {
    await upsertTicket({
      raffleId: IDS.raffleHomeActive,
      number,
      buyerId:
        number <= 2 ? buyerNew.id : number <= 4 ? buyerWinner.id : buyer.id,
      status: TicketStatus.PAGADO,
      price: 980,
      mpPaymentId: `qa_mp_home_active_${number}`,
      purchasedAt: daysAgo(2),
    });
  }

  await upsertRaffle({
    id: IDS.raffleFashionActive,
    sellerId: other.id,
    categoryId: fashionCategoryId,
    title: `${QA_PREFIX} Zapatillas edición limitada`,
    description: 'Rifa activa de moda para poblar categorías no electrónicas.',
    totalTickets: 28,
    price: 890,
    deadline: daysFromNow(9),
    status: RaffleStatus.ACTIVA,
    viewCount: 131,
    productCategory: 'Moda',
    productCondition: ProductCondition.NUEVO,
  });
  await deleteDrawResultIfAny(IDS.raffleFashionActive);
  for (let number = 1; number <= 5; number++) {
    await upsertTicket({
      raffleId: IDS.raffleFashionActive,
      number,
      buyerId:
        number <= 2
          ? buyerPromo.id
          : number <= 4
            ? buyerNew.id
            : buyerWinner.id,
      status: TicketStatus.PAGADO,
      price: 890,
      mpPaymentId: `qa_mp_fashion_active_${number}`,
      purchasedAt: daysAgo(2),
    });
  }

  await upsertRaffle({
    id: IDS.raffleSportsActive,
    sellerId: sellerGrowth.id,
    categoryId: sportsCategoryId,
    title: `${QA_PREFIX} Bicicleta gravel`,
    description:
      'Rifa activa de deportes para poblar búsqueda y seller profile.',
    totalTickets: 32,
    price: 1150,
    deadline: daysFromNow(13),
    status: RaffleStatus.ACTIVA,
    viewCount: 110,
    productCategory: 'Deportes',
  });
  await deleteDrawResultIfAny(IDS.raffleSportsActive);
  for (let number = 1; number <= 7; number++) {
    await upsertTicket({
      raffleId: IDS.raffleSportsActive,
      number,
      buyerId:
        number <= 3 ? buyerHeavy.id : number <= 5 ? buyerPack.id : buyer.id,
      status: TicketStatus.PAGADO,
      price: 1150,
      mpPaymentId: `qa_mp_sports_active_${number}`,
      purchasedAt: daysAgo(3),
    });
  }

  await upsertRaffle({
    id: IDS.raffleEntertainmentActive,
    sellerId: sellerPro.id,
    categoryId: entertainmentCategoryId,
    title: `${QA_PREFIX} PlayStation 5`,
    description:
      'Rifa activa de entretenimiento para QA general de home y search.',
    totalTickets: 45,
    price: 990,
    deadline: daysFromNow(18),
    status: RaffleStatus.ACTIVA,
    viewCount: 342,
    productCategory: 'Entretenimiento',
  });
  await deleteDrawResultIfAny(IDS.raffleEntertainmentActive);
  for (let number = 1; number <= 12; number++) {
    await upsertTicket({
      raffleId: IDS.raffleEntertainmentActive,
      number,
      buyerId:
        number <= 4
          ? buyerHeavy.id
          : number <= 8
            ? buyerPromo.id
            : buyerPack.id,
      status: TicketStatus.PAGADO,
      price: 990,
      mpPaymentId: `qa_mp_entertainment_active_${number}`,
      purchasedAt: daysAgo(5),
    });
  }

  await upsertRaffle({
    id: IDS.raffleCancelledRefunded,
    sellerId: sellerGrowth.id,
    categoryId: homeCategoryId,
    title: `${QA_PREFIX} Cancelada con refund`,
    description:
      'Rifa cancelada con tickets ya reembolsados para QA de historial.',
    totalTickets: 12,
    price: 840,
    deadline: daysAgo(6),
    status: RaffleStatus.CANCELADA,
    viewCount: 53,
    productCategory: 'Hogar',
  });
  await deleteDrawResultIfAny(IDS.raffleCancelledRefunded);
  for (let number = 1; number <= 4; number++) {
    await upsertTicket({
      raffleId: IDS.raffleCancelledRefunded,
      number,
      buyerId: number <= 2 ? buyerRefund.id : buyerDispute.id,
      status: TicketStatus.REEMBOLSADO,
      price: 840,
      mpPaymentId: `qa_mp_cancelled_refund_${number}`,
      purchasedAt: daysAgo(7),
    });
  }

  await upsertRaffle({
    id: IDS.raffleFinalizedGrowthReviewed,
    sellerId: sellerGrowth.id,
    categoryId: sportsCategoryId,
    title: `${QA_PREFIX} Finalizada seller growth`,
    description:
      'Rifa finalizada con review para poblar reputación pública de seller PLATA.',
    totalTickets: 6,
    price: 1110,
    deadline: daysAgo(17),
    status: RaffleStatus.FINALIZADA,
    deliveryStatus: DeliveryStatus.CONFIRMED,
    winnerId: buyerPromo.id,
    drawDate: daysAgo(16),
    trackingNumber: 'QA-GROWTH-REVIEW-77',
    shippedAt: daysAgo(15),
    confirmedAt: daysAgo(13),
    paymentReleasedAt: daysAgo(12),
    viewCount: 96,
    productCategory: 'Deportes',
  });
  for (let number = 1; number <= 4; number++) {
    await upsertTicket({
      raffleId: IDS.raffleFinalizedGrowthReviewed,
      number,
      buyerId:
        number === 1
          ? buyerPromo.id
          : number <= 3
            ? buyerHeavy.id
            : buyerPack.id,
      status: TicketStatus.PAGADO,
      price: 1110,
      mpPaymentId: `qa_mp_growth_review_${number}`,
      purchasedAt: daysAgo(17),
    });
  }
  await upsertDrawResult({
    raffleId: IDS.raffleFinalizedGrowthReviewed,
    winningTicketId: ticketId(IDS.raffleFinalizedGrowthReviewed, 1),
    winnerId: buyerPromo.id,
    participants: 4,
  });
  await upsertPayout({
    raffleId: IDS.raffleFinalizedGrowthReviewed,
    sellerId: sellerGrowth.id,
    grossAmount: 4440,
    platformFee: 177.6,
    processingFee: 222,
    netAmount: 4040.4,
    status: PayoutStatus.COMPLETED,
    scheduledFor: daysAgo(13),
    processedAt: daysAgo(12),
  });

  await upsertRaffle({
    id: IDS.raffleFinalizedReviewed,
    sellerId: sellerPro.id,
    categoryId: electronicsCategoryId,
    title: `${QA_PREFIX} Finalizada con review`,
    description:
      'Rifa finalizada con payout, review y mensajería post entrega.',
    totalTickets: 8,
    price: 1320,
    deadline: daysAgo(20),
    status: RaffleStatus.FINALIZADA,
    deliveryStatus: DeliveryStatus.CONFIRMED,
    winnerId: buyerWinner.id,
    drawDate: daysAgo(18),
    trackingNumber: 'QA-REVIEW-TRACK-88',
    shippedAt: daysAgo(17),
    confirmedAt: daysAgo(16),
    paymentReleasedAt: daysAgo(15),
    viewCount: 142,
  });
  for (let number = 1; number <= 5; number++) {
    await upsertTicket({
      raffleId: IDS.raffleFinalizedReviewed,
      number,
      buyerId:
        number === 1 ? buyerWinner.id : number <= 3 ? buyer.id : buyerHeavy.id,
      status: TicketStatus.PAGADO,
      price: 1320,
      mpPaymentId: `qa_mp_final_review_${number}`,
      purchasedAt: daysAgo(19),
    });
  }
  await upsertDrawResult({
    raffleId: IDS.raffleFinalizedReviewed,
    winningTicketId: ticketId(IDS.raffleFinalizedReviewed, 1),
    winnerId: buyerWinner.id,
    participants: 5,
  });
  await upsertPayout({
    raffleId: IDS.raffleFinalizedReviewed,
    sellerId: sellerPro.id,
    grossAmount: 6600,
    platformFee: 264,
    processingFee: 330,
    netAmount: 6006,
    status: PayoutStatus.COMPLETED,
    scheduledFor: daysAgo(16),
    processedAt: daysAgo(15),
  });

  await upsertRaffle({
    id: IDS.raffleDisputeResolvedSeller,
    sellerId: sellerPro.id,
    categoryId: electronicsCategoryId,
    title: `${QA_PREFIX} Disputa resuelta vendedor`,
    description: 'Caso histórico de disputa resuelta a favor del vendedor.',
    totalTickets: 6,
    price: 1180,
    deadline: daysAgo(18),
    status: RaffleStatus.FINALIZADA,
    deliveryStatus: DeliveryStatus.CONFIRMED,
    winnerId: buyerDispute.id,
    drawDate: daysAgo(17),
    shippedAt: daysAgo(16),
    confirmedAt: daysAgo(14),
    paymentReleasedAt: daysAgo(13),
    viewCount: 84,
  });
  await upsertTicket({
    raffleId: IDS.raffleDisputeResolvedSeller,
    number: 1,
    buyerId: buyerDispute.id,
    status: TicketStatus.PAGADO,
    price: 1180,
    mpPaymentId: 'qa_mp_dispute_seller_1',
    purchasedAt: daysAgo(18),
  });
  await upsertDrawResult({
    raffleId: IDS.raffleDisputeResolvedSeller,
    winningTicketId: ticketId(IDS.raffleDisputeResolvedSeller, 1),
    winnerId: buyerDispute.id,
    participants: 1,
  });
  await upsertDispute({
    raffleId: IDS.raffleDisputeResolvedSeller,
    reporterId: buyerDispute.id,
    type: DisputeType.DIFERENTE,
    status: DisputeStatus.RESUELTA_VENDEDOR,
    title: `${QA_PREFIX} Resuelta a favor del vendedor`,
    description: 'Fixture para QA de disputa cerrada a favor del vendedor.',
    buyerEvidence: [
      'https://picsum.photos/seed/qa-dispute-seller-buyer/600/400',
    ],
    createdAt: daysAgo(15),
    sellerResponse: 'Adjuntamos pruebas de publicación y guía de entrega.',
    sellerEvidence: ['https://picsum.photos/seed/qa-dispute-seller/600/400'],
    respondedAt: daysAgo(14),
    resolution:
      'La evidencia del vendedor fue suficiente. No corresponde refund.',
    refundAmount: 0,
    sellerAmount: 1180,
    adminNotes: 'Caso QA resuelto a favor del vendedor.',
    resolvedAt: daysAgo(13),
  });

  await upsertRaffle({
    id: IDS.raffleDisputeResolvedPartial,
    sellerId: sellerGrowth.id,
    categoryId: electronicsCategoryId,
    title: `${QA_PREFIX} Disputa resuelta parcial`,
    description:
      'Fixture para QA de resolución parcial con reparto entre buyer y seller.',
    totalTickets: 6,
    price: 1240,
    deadline: daysAgo(16),
    status: RaffleStatus.FINALIZADA,
    deliveryStatus: DeliveryStatus.DISPUTED,
    winnerId: buyerDispute.id,
    drawDate: daysAgo(15),
    shippedAt: daysAgo(14),
    viewCount: 77,
  });
  await upsertTicket({
    raffleId: IDS.raffleDisputeResolvedPartial,
    number: 1,
    buyerId: buyerDispute.id,
    status: TicketStatus.PAGADO,
    price: 1240,
    mpPaymentId: 'qa_mp_dispute_partial_1',
    purchasedAt: daysAgo(16),
  });
  await upsertDrawResult({
    raffleId: IDS.raffleDisputeResolvedPartial,
    winningTicketId: ticketId(IDS.raffleDisputeResolvedPartial, 1),
    winnerId: buyerDispute.id,
    participants: 1,
  });
  await upsertDispute({
    raffleId: IDS.raffleDisputeResolvedPartial,
    reporterId: buyerDispute.id,
    type: DisputeType.DANADO,
    status: DisputeStatus.RESUELTA_PARCIAL,
    title: `${QA_PREFIX} Resuelta parcialmente`,
    description: 'Caso para QA de refund parcial y payout parcial al vendedor.',
    buyerEvidence: [
      'https://picsum.photos/seed/qa-dispute-partial-buyer/600/400',
    ],
    createdAt: daysAgo(12),
    sellerResponse:
      'Ofrecimos compensación parcial por el daño estético informado.',
    sellerEvidence: ['https://picsum.photos/seed/qa-dispute-partial/600/400'],
    respondedAt: daysAgo(11),
    resolution:
      'Se reconoce daño parcial. Corresponde refund parcial al comprador.',
    refundAmount: 620,
    sellerAmount: 620,
    adminNotes: 'Fixture QA de disputa parcial.',
    resolvedAt: daysAgo(10),
  });

  await upsertPayout({
    raffleId: IDS.raffleDisputeResolvedSeller,
    sellerId: sellerPro.id,
    grossAmount: 1180,
    platformFee: 47.2,
    processingFee: 59,
    netAmount: 1073.8,
    status: PayoutStatus.COMPLETED,
    scheduledFor: daysAgo(14),
    processedAt: daysAgo(13),
  });

  await upsertPriceHistory({
    id: priceHistoryId(IDS.rafflePriceDropActive, 1),
    raffleId: IDS.rafflePriceDropActive,
    previousPrice: 2500,
    newPrice: 2200,
    changedAt: daysAgo(9),
  });
  await upsertPriceHistory({
    id: priceHistoryId(IDS.rafflePriceDropActive, 2),
    raffleId: IDS.rafflePriceDropActive,
    previousPrice: 2200,
    newPrice: 1800,
    changedAt: hoursAgo(18),
  });
  await upsertPriceHistory({
    id: priceHistoryId(IDS.raffleCancelledRelaunch, 1),
    raffleId: IDS.raffleCancelledRelaunch,
    previousPrice: 1200,
    newPrice: 1000,
    changedAt: daysAgo(12),
  });

  await Promise.all([
    upsertFavorite(buyer.id, IDS.raffleActive, daysAgo(1)),
    upsertFavorite(buyer.id, IDS.rafflePriceDropActive, daysAgo(1)),
    upsertFavorite(buyerNew.id, IDS.raffleAlmostSold, hoursAgo(8)),
    upsertFavorite(buyerNew.id, IDS.rafflePriceDropActive, hoursAgo(6)),
    upsertFavorite(buyerPromo.id, IDS.raffleFashionActive, daysAgo(2)),
    upsertFavorite(buyerPromo.id, IDS.raffleSportsActive, daysAgo(2)),
    upsertFavorite(buyerHeavy.id, IDS.raffleEntertainmentActive, daysAgo(3)),
    upsertFavorite(buyerHeavy.id, IDS.raffleFinalizedReviewed, daysAgo(10)),
    upsertFavorite(buyerPack.id, IDS.rafflePackFive, hoursAgo(3)),
    upsertFavorite(googleOnly.id, IDS.raffleNewLaunch, hoursAgo(2)),
  ]);

  await upsertQuestionThread({
    raffleId: IDS.raffleActive,
    index: 1,
    askerId: buyer.id,
    question: '¿Tiene garantía oficial y caja sellada?',
    questionCreatedAt: daysAgo(1),
    sellerId: seller.id,
    answer: 'Sí, viene sellado y con garantía oficial de 12 meses.',
    answerCreatedAt: hoursAgo(20),
  });
  await upsertQuestionThread({
    raffleId: IDS.raffleChooseNumbers,
    index: 1,
    askerId: buyerNew.id,
    question: '¿Puedo elegir números separados o tienen que ser consecutivos?',
    questionCreatedAt: hoursAgo(18),
    sellerId: sellerPro.id,
    answer:
      'Podés elegir cualquier combinación disponible; no hace falta que sean consecutivos.',
    answerCreatedAt: hoursAgo(16),
  });
  await upsertQuestionThread({
    raffleId: IDS.rafflePriceDropActive,
    index: 1,
    askerId: buyerPromo.id,
    question: '¿El precio bajó porque cambió algo del premio?',
    questionCreatedAt: hoursAgo(22),
    sellerId: sellerGrowth.id,
    answer:
      'No, es el mismo premio. Bajamos el ticket para acelerar la liquidación.',
    answerCreatedAt: hoursAgo(18),
  });
  await upsertQuestionThread({
    raffleId: IDS.rafflePackTen,
    index: 1,
    askerId: buyerPack.id,
    question: '¿El pack de 10 aplica siempre o sólo si queda stock suficiente?',
    questionCreatedAt: hoursAgo(4),
  });
  await upsertQuestionThread({
    raffleId: IDS.raffleActive,
    index: 2,
    askerId: buyerHeavy.id,
    question: '¿Incluye cargador original y factura de compra?',
    questionCreatedAt: hoursAgo(9),
  });
  await upsertQuestionThread({
    raffleId: IDS.rafflePackFive,
    index: 1,
    askerId: buyerPack.id,
    question:
      'Si compro 5 tickets, ¿el ticket extra aparece con número propio?',
    questionCreatedAt: hoursAgo(7),
    sellerId: sellerGrowth.id,
    answer:
      'Sí, el bonus se emite como ticket real y lo vas a ver junto al resto de tus números.',
    answerCreatedAt: hoursAgo(6),
  });
  await upsertQuestionThread({
    raffleId: IDS.rafflePackTen,
    index: 2,
    askerId: buyerHeavy.id,
    question: 'Si quedan pocos tickets, ¿se bloquea la compra de 10?',
    questionCreatedAt: hoursAgo(3),
    sellerId: sellerPro.id,
    answer:
      'No se bloquea si la cantidad base entra. Si el bonus no entra por stock, comprás normal.',
    answerCreatedAt: hoursAgo(2),
  });
  await upsertQuestionThread({
    raffleId: IDS.raffleNewLaunch,
    index: 1,
    askerId: googleOnly.id,
    question: '¿Podés subir una foto del producto encendido?',
    questionCreatedAt: hoursAgo(5),
  });
  await upsertQuestionThread({
    raffleId: IDS.raffleHomeActive,
    index: 1,
    askerId: buyerWinner.id,
    question: '¿La cafetera viene con accesorios y manual?',
    questionCreatedAt: daysAgo(1),
    sellerId: sellerPro.id,
    answer: 'Sí, incluye manual, accesorios originales y caja completa.',
    answerCreatedAt: hoursAgo(19),
  });
  await upsertQuestionThread({
    raffleId: IDS.raffleFashionActive,
    index: 1,
    askerId: buyerPromo.id,
    question: '¿Qué talle son y tenés foto de la etiqueta interna?',
    questionCreatedAt: hoursAgo(15),
    sellerId: other.id,
    answer:
      'Son talle 42 AR. La etiqueta se ve en la tercera foto de la publicación.',
    answerCreatedAt: hoursAgo(12),
  });
  await upsertQuestionThread({
    raffleId: IDS.raffleFashionActive,
    index: 2,
    askerId: buyerNew.id,
    question: '¿La caja está en buen estado?',
    questionCreatedAt: hoursAgo(4),
  });
  await upsertQuestionThread({
    raffleId: IDS.raffleSportsActive,
    index: 1,
    askerId: buyerHeavy.id,
    question: '¿Para qué altura recomendás el talle de la bicicleta?',
    questionCreatedAt: daysAgo(2),
    sellerId: sellerGrowth.id,
    answer: 'Va bien para personas entre 1,70 m y 1,82 m aproximadamente.',
    answerCreatedAt: daysAgo(1),
  });
  await upsertQuestionThread({
    raffleId: IDS.raffleEntertainmentActive,
    index: 1,
    askerId: buyerPack.id,
    question: '¿La PlayStation tiene garantía vigente?',
    questionCreatedAt: daysAgo(1),
    sellerId: sellerPro.id,
    answer: 'Sí, tiene garantía vigente hasta fin de año.',
    answerCreatedAt: hoursAgo(20),
  });
  await upsertQuestionThread({
    raffleId: IDS.raffleEntertainmentActive,
    index: 2,
    askerId: buyerRefund.id,
    question: '¿Incluye joystick adicional?',
    questionCreatedAt: hoursAgo(11),
  });
  await upsertQuestionThread({
    raffleId: IDS.raffleAlmostSold,
    index: 1,
    askerId: buyerNew.id,
    question: 'Si se agota hoy, ¿el sorteo se hace automáticamente?',
    questionCreatedAt: hoursAgo(10),
    sellerId: sellerPro.id,
    answer:
      'Sí, cuando llega al 100% el sistema intenta sortear automáticamente.',
    answerCreatedAt: hoursAgo(8),
  });
  await upsertQuestionThread({
    raffleId: IDS.raffleBonusTargetOther,
    index: 1,
    askerId: buyerPromo.id,
    question: '¿Puedo usar una bonificación promocional en esta rifa?',
    questionCreatedAt: hoursAgo(14),
    sellerId: other.id,
    answer: 'Sí, si tenés un bonus disponible y la compra cumple las reglas.',
    answerCreatedAt: hoursAgo(13),
  });

  await upsertConversationThread({
    raffleId: IDS.raffleShipped,
    user1Id: buyer.id,
    user2Id: seller.id,
    messages: [
      {
        index: 1,
        senderId: seller.id,
        content:
          'Ya despaché el premio. Te comparto el tracking por acá también.',
        isRead: true,
        createdAt: hoursAgo(20),
      },
      {
        index: 2,
        senderId: buyer.id,
        content: 'Perfecto, gracias. Apenas llegue confirmo la entrega.',
        isRead: true,
        createdAt: hoursAgo(18),
      },
      {
        index: 3,
        senderId: seller.id,
        content: 'Cualquier cosa escribime por este chat.',
        isRead: false,
        createdAt: hoursAgo(17),
      },
    ],
  });

  await upsertConversationThread({
    raffleId: IDS.raffleFinalizedReviewed,
    user1Id: buyerWinner.id,
    user2Id: sellerPro.id,
    messages: [
      {
        index: 1,
        senderId: buyerWinner.id,
        content: 'Llegó impecable. Gracias por el seguimiento.',
        isRead: true,
        createdAt: daysAgo(16),
      },
      {
        index: 2,
        senderId: sellerPro.id,
        content: 'Buenísimo. Si podés dejar review me ayuda un montón.',
        isRead: true,
        createdAt: daysAgo(16),
      },
    ],
  });

  await Promise.all([
    upsertReview({
      raffleId: IDS.raffleFinalizedPayout,
      reviewerId: buyer.id,
      sellerId: seller.id,
      rating: 4,
      comentario:
        'El premio llegó bien. El vendedor tardó un poco en responder, pero cumplió.',
      createdAt: daysAgo(9),
    }),
    upsertReview({
      raffleId: IDS.raffleFinalizedGrowthReviewed,
      reviewerId: buyerPromo.id,
      sellerId: sellerGrowth.id,
      rating: 5,
      comentario:
        'Excelente seguimiento del envío y el producto llegó igual a las fotos.',
      createdAt: daysAgo(12),
    }),
    upsertReview({
      raffleId: IDS.raffleFinalizedReviewed,
      reviewerId: buyerWinner.id,
      sellerId: sellerPro.id,
      rating: 5,
      comentario:
        'Todo llegó impecable y el vendedor respondió siempre rápido.',
      createdAt: daysAgo(15),
    }),
    upsertReview({
      raffleId: IDS.raffleDisputeResolvedSeller,
      reviewerId: buyerDispute.id,
      sellerId: sellerPro.id,
      rating: 2,
      comentario:
        'Comentario oculto para QA: tono agresivo que admin debería moderar.',
      createdAt: daysAgo(12),
      commentHidden: true,
      commentHiddenReason:
        'Fixture QA: comentario agresivo oculto por moderación.',
      commentHiddenAt: daysAgo(11),
      commentHiddenById: adminOps.id,
    }),
  ]);

  await Promise.all([
    upsertTransaction({
      id: transactionId('pack_five_purchase'),
      tipo: TransactionType.COMPRA_TICKET,
      userId: buyerPack.id,
      raffleId: IDS.rafflePackFive,
      monto: 12600,
      grossAmount: 12600,
      cashChargedAmount: 10500,
      comisionPlataforma: 504,
      feeProcesamiento: 630,
      montoNeto: 11466,
      mpPaymentId: 'qa_mp_tx_pack_five',
      metadata: {
        packApplied: true,
        baseQuantity: 5,
        bonusQuantity: 1,
        grantedQuantity: 6,
      },
    }),
    upsertTransaction({
      id: transactionId('pack_five_subsidy'),
      tipo: TransactionType.SUBSIDIO_PACK_PLATAFORMA,
      userId: buyerPack.id,
      raffleId: IDS.rafflePackFive,
      monto: 2100,
      grossAmount: 12600,
      cashChargedAmount: 10500,
      mpPaymentId: 'qa_mp_tx_pack_five',
      metadata: {
        baseQuantity: 5,
        bonusQuantity: 1,
        grantedQuantity: 6,
      },
    }),
    upsertTransaction({
      id: transactionId('cancelled_refund_purchase'),
      tipo: TransactionType.COMPRA_TICKET,
      userId: buyerRefund.id,
      raffleId: IDS.raffleCancelledRefunded,
      monto: 1680,
      grossAmount: 1680,
      cashChargedAmount: 1680,
      mpPaymentId: 'qa_mp_cancelled_refund_group',
      estado: TransactionStatus.REEMBOLSADO,
      metadata: {
        refundedTicketNumbers: [1, 2],
      },
    }),
    upsertTransaction({
      id: transactionId('cancelled_refund_refund'),
      tipo: TransactionType.REEMBOLSO,
      userId: buyerRefund.id,
      raffleId: IDS.raffleCancelledRefunded,
      monto: 1680,
      grossAmount: 1680,
      cashChargedAmount: 1680,
      mpPaymentId: 'qa_mp_cancelled_refund_group',
      estado: TransactionStatus.REEMBOLSADO,
      metadata: {
        refundedTicketNumbers: [1, 2],
      },
    }),
    upsertTransaction({
      id: transactionId('final_review_purchase'),
      tipo: TransactionType.COMPRA_TICKET,
      userId: buyerWinner.id,
      raffleId: IDS.raffleFinalizedReviewed,
      monto: 1320,
      grossAmount: 1320,
      cashChargedAmount: 1320,
      comisionPlataforma: 52.8,
      feeProcesamiento: 66,
      montoNeto: 1201.2,
      mpPaymentId: 'qa_mp_final_review_1',
      metadata: {
        purchaseMode: 'RANDOM',
      },
    }),
    upsertTransaction({
      id: transactionId('final_review_payout'),
      tipo: TransactionType.PAGO_VENDEDOR,
      userId: sellerPro.id,
      raffleId: IDS.raffleFinalizedReviewed,
      monto: 6006,
      grossAmount: 6600,
      cashChargedAmount: 6600,
      montoNeto: 6006,
      estado: TransactionStatus.COMPLETADO,
      metadata: {
        payoutStatus: 'COMPLETED',
      },
    }),
  ]);

  await Promise.all([
    upsertNotification({
      id: notificationId('price_drop_active_buyer'),
      userId: buyer.id,
      type: 'PRICE_DROP',
      title: 'Bajó el precio de una rifa guardada',
      message:
        'La rifa con precio rebajado ahora tiene tickets más baratos. Revisala antes de que se liquide.',
      actionUrl: `/raffle/${IDS.rafflePriceDropActive}`,
      createdAt: hoursAgo(16),
    }),
    upsertNotification({
      id: notificationId('new_winner_review'),
      userId: buyerWinner.id,
      type: 'INFO',
      title: 'Ya podés dejar tu review',
      message:
        'Confirmaste la entrega. Si querés, dejá una review del vendedor.',
      actionUrl: `/raffle/${IDS.raffleFinalizedReviewed}`,
      createdAt: daysAgo(15),
      read: true,
    }),
    upsertNotification({
      id: notificationId('pack_banner_hint'),
      userId: buyerPack.id,
      type: 'INFO',
      title: 'Probá los packs simples',
      message:
        'En compras aleatorias de ciertas cantidades podés recibir tickets bonus subsidiados por LUK.',
      actionUrl: `/raffle/${IDS.rafflePackFive}`,
      createdAt: hoursAgo(2),
    }),
  ]);

  await Promise.all([
    upsertActivityLog({
      id: activityLogId('buyer_pack_purchase'),
      userId: buyerPack.id,
      action: ActivityType.TICKETS_PURCHASED,
      targetType: 'Raffle',
      targetId: IDS.rafflePackFive,
      metadata: {
        baseQuantity: 5,
        bonusQuantity: 1,
        grantedQuantity: 6,
      },
      createdAt: hoursAgo(2),
    }),
    upsertActivityLog({
      id: activityLogId('seller_pro_payout'),
      userId: sellerPro.id,
      action: ActivityType.PAYOUT_RELEASED,
      targetType: 'Raffle',
      targetId: IDS.raffleFinalizedReviewed,
      metadata: {
        netAmount: 6006,
      },
      createdAt: daysAgo(15),
    }),
    upsertActivityLog({
      id: activityLogId('buyer_dispute_open'),
      userId: buyerDispute.id,
      action: ActivityType.DISPUTE_OPENED,
      targetType: 'Raffle',
      targetId: IDS.raffleDisputeResolvedPartial,
      metadata: {
        disputeStatus: DisputeStatus.RESUELTA_PARCIAL,
      },
      createdAt: daysAgo(12),
    }),
  ]);

  await upsertEmailVerificationCode({
    id: emailVerificationCodeId('unverified_email'),
    userId: unverifiedEmailUser.id,
    code: '334455',
    expiresAt: daysFromNow(2),
    createdAt: hoursAgo(1),
  });

  await upsertSampleReport(IDS.raffleActive, buyer.id);
  await upsertSampleReport(IDS.rafflePriceDropActive, buyerNew.id);
  await upsertSampleReport(IDS.raffleFashionActive, buyerPromo.id);

  await upsertSocialPromotionFixture({
    sellerId: seller.id,
    sellerEmail: seller.email,
    sellerName: seller.nombre,
    sourceRaffleId: IDS.raffleFinalizedPayout,
  });

  console.log('✅ Canonical QA/dev seed completed');
  console.log('Login accounts:');
  console.log(`- Admin:     ${USERS.admin} / ${DEFAULT_ADMIN_PASSWORD}`);
  console.log(`- Seller:    ${USERS.seller} / ${DEFAULT_PASSWORD}`);
  console.log(`- Buyer:     ${USERS.buyer} / ${DEFAULT_PASSWORD}`);
  console.log(`- Other:     ${USERS.other} / ${DEFAULT_PASSWORD}`);
  console.log(`- KYC none:  ${USERS.unverifiedKyc} / ${DEFAULT_PASSWORD}`);
  console.log(`- KYC wait:  ${USERS.pendingKyc} / ${DEFAULT_PASSWORD}`);
  console.log(`- KYC reject:${USERS.rejectedKyc} / ${DEFAULT_PASSWORD}`);
  console.log(`- Seller Pro: ${USERS.sellerPro} / ${DEFAULT_PASSWORD}`);
  console.log(`- Seller Grw: ${USERS.sellerGrowth} / ${DEFAULT_PASSWORD}`);
  console.log(`- No MP:      ${USERS.sellerNoMp} / ${DEFAULT_PASSWORD}`);
  console.log(`- No address: ${USERS.sellerNoAddress} / ${DEFAULT_PASSWORD}`);
  console.log(`- MP pending: ${USERS.sellerPendingMp} / ${DEFAULT_PASSWORD}`);
  console.log(`- Buyer heavy:${USERS.buyerHeavy} / ${DEFAULT_PASSWORD}`);
  console.log(`- Buyer win:  ${USERS.buyerWinner} / ${DEFAULT_PASSWORD}`);
  console.log(`- Buyer refund:${USERS.buyerRefund} / ${DEFAULT_PASSWORD}`);
  console.log(`- Buyer disp: ${USERS.buyerDispute} / ${DEFAULT_PASSWORD}`);
  console.log(`- Buyer new:  ${USERS.buyerNew} / ${DEFAULT_PASSWORD}`);
  console.log(`- Buyer promo:${USERS.buyerPromo} / ${DEFAULT_PASSWORD}`);
  console.log(`- Buyer pack: ${USERS.buyerPack} / ${DEFAULT_PASSWORD}`);
  console.log(`- Google only:${USERS.googleOnly} / Google OAuth only`);
  console.log(
    `- Email unverified: ${USERS.unverifiedEmail} / ${DEFAULT_PASSWORD} (code 334455)`,
  );
  console.log(`- Banned:     ${USERS.banned} / ${DEFAULT_PASSWORD}`);
  console.log(`- Admin Ops:  ${USERS.adminOps} / ${DEFAULT_ADMIN_PASSWORD}`);
  console.log('');
  console.log('Suggested manual QA routes:');
  console.log(`- /raffle/${IDS.raffleActive}`);
  console.log(`- /raffle/${IDS.raffleBonusTargetOther}`);
  console.log(`- /raffle/${IDS.rafflePackFive}`);
  console.log(`- /raffle/${IDS.rafflePackTen}`);
  console.log(`- /raffle/${IDS.rafflePackLowStock}`);
  console.log(`- /raffle/${IDS.rafflePackBuyerLimit}`);
  console.log(`- /raffle/${IDS.raffleChooseNumbers}`);
  console.log(`- /raffle/${IDS.rafflePriceDropActive}`);
  console.log(`- /raffle/${IDS.raffleAlmostSold}`);
  console.log(`- /raffle/${IDS.raffleCancelledRefunded}`);
  console.log(`- /raffle/${IDS.raffleFinalizedGrowthReviewed}`);
  console.log(`- /raffle/${IDS.raffleFinalizedReviewed}`);
  console.log('- /dashboard/sales');
  console.log('- /dashboard/tickets');
  console.log('- /dashboard/disputes');
  console.log('- /dashboard/payouts');
  console.log('- /dashboard/settings');
  console.log('- /admin');
  console.log(
    `- /dashboard/sales?action=relaunch&priceReductionId=${IDS.priceReduction}`,
  );
}

main()
  .catch((error) => {
    console.error('❌ Canonical QA/dev seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

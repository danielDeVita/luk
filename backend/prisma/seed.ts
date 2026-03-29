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
  DocumentType,
  PromotionBonusGrantStatus,
  SocialPromotionNetwork,
  SocialPromotionStatus,
  SocialPromotionAttributionEventType,
  SellerLevel,
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

async function upsertUser(params: {
  email: string;
  nombre: string;
  apellido: string;
  passwordHash: string;
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
}) {
  const {
    email,
    nombre,
    apellido,
    passwordHash,
    role = UserRole.USER,
    emailVerified = true,
    kycStatus = KycStatus.NOT_SUBMITTED,
    kycSubmittedAt = null,
    kycVerifiedAt = kycStatus === KycStatus.VERIFIED ? new Date() : null,
    kycRejectedReason = null,
    mpConnectStatus = MpConnectStatus.NOT_CONNECTED,
    mpUserId = null,
    mpAccessToken = null,
    documentType = null,
    documentNumber = null,
  } = params;

  return prisma.user.upsert({
    where: { email },
    update: {
      nombre,
      apellido,
      passwordHash,
      role,
      emailVerified,
      emailVerifiedAt: emailVerified ? new Date() : null,
      termsAcceptedAt: new Date(),
      termsVersion: '1.0',
      kycStatus,
      kycSubmittedAt,
      kycVerifiedAt,
      kycRejectedReason,
      mpConnectStatus,
      mpUserId,
      mpAccessToken,
      documentType,
      documentNumber,
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
      emailVerifiedAt: emailVerified ? new Date() : null,
      termsAcceptedAt: new Date(),
      termsVersion: '1.0',
      kycStatus,
      kycSubmittedAt,
      kycVerifiedAt,
      kycRejectedReason,
      mpConnectStatus,
      mpUserId,
      mpAccessToken,
      documentType,
      documentNumber,
    },
  });
}

async function upsertUserReputation(userId: string, maxRifasSimultaneas = 3) {
  await prisma.userReputation.upsert({
    where: { userId },
    update: {
      maxRifasSimultaneas,
      nivelVendedor: SellerLevel.NUEVO,
    },
    create: {
      userId,
      maxRifasSimultaneas,
      nivelVendedor: SellerLevel.NUEVO,
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
      evidencias: ['https://picsum.photos/seed/canonical-dispute/600/400'],
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
      evidencias: ['https://picsum.photos/seed/canonical-dispute/600/400'],
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

async function upsertSampleReport(raffleId: string, reporterId: string) {
  await prisma.report.upsert({
    where: {
      raffleId_reporterId: {
        raffleId,
        reporterId,
      },
    },
    update: {
      reason:
        'Fixture QA para validar listado y review de reportes en admin.',
      reviewed: false,
      reviewedAt: null,
      adminNotes: null,
    },
    create: {
      id: IDS.reportActiveRaffle,
      raffleId,
      reporterId,
      reason:
        'Fixture QA para validar listado y review de reportes en admin.',
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
      message:
        `Hola ${sellerName}. Tu post promocional de ${sellerEmail} generó un grant del 10% off hasta $10000. Revisalo en Tus tickets.`,
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
  });

  await upsertUser({
    email: USERS.admin,
    nombre: 'Admin',
    apellido: 'Test',
    passwordHash: adminHash,
    role: UserRole.ADMIN,
    kycStatus: KycStatus.VERIFIED,
    kycVerifiedAt: daysAgo(60),
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

  await prisma.user.update({
    where: { id: seller.id },
    data: { defaultSenderAddressId: IDS.sellerAddress },
  });

  await prisma.user.update({
    where: { id: other.id },
    data: { defaultSenderAddressId: IDS.otherAddress },
  });

  await Promise.all([
    upsertUserReputation(seller.id),
    upsertUserReputation(buyer.id),
    upsertUserReputation(other.id),
  ]);

  const categories = await upsertCategories();
  const electronicsCategoryId = categories.get('Electronica') ?? null;

  await upsertRaffle({
    id: IDS.raffleActive,
    sellerId: seller.id,
    categoryId: electronicsCategoryId,
    title: `${QA_PREFIX} iPhone 15 Pro - Activa`,
    description: 'Rifa activa visible para pruebas de búsqueda, compra y favoritos.',
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
    description: 'Rifa vendida al 100% en COMPLETADA sin winner para probar auto-draw.',
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
    description: 'Ganador definido, sin envío para probar bloqueo de confirmación.',
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
    description: 'Escenario para cancelación y reembolso por bajo porcentaje vendido.',
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
    description: 'Rifa activa de otro seller para probar redención del grant promocional.',
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
      'Disputa antigua para verificar auto-refund por cron si supera 15 días.',
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
    createdAt: daysAgo(9),
    sellerResponse:
      'El paquete salió del depósito pero no tenemos tracking válido para presentarlo.',
    sellerEvidence: ['https://picsum.photos/seed/canonical-seller-final/600/400'],
    respondedAt: daysAgo(8),
    resolution:
      'Se verificó falta de evidencia suficiente del envío. Corresponde reembolso total.',
    refundAmount: 1100,
    sellerAmount: 0,
    adminNotes: 'Fixture QA de disputa resuelta a favor del comprador.',
    resolvedAt: daysAgo(7),
  });

  await upsertSampleReport(IDS.raffleActive, buyer.id);

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
  console.log('');
  console.log('Suggested manual QA routes:');
  console.log(`- /raffle/${IDS.raffleActive}`);
  console.log(`- /raffle/${IDS.raffleBonusTargetOther}`);
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

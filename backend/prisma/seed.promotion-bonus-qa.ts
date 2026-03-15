import {
  PrismaClient,
  DeliveryStatus,
  MpConnectStatus,
  ProductCondition,
  PromotionBonusGrantStatus,
  RaffleStatus,
  SocialPromotionNetwork,
  SocialPromotionStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const USERS = {
  seller: 'qa.seller@test.com',
  other: 'qa.other@test.com',
};

const IDS = {
  sourceDraft: 'qa_social_promo_bonus_draft',
  sourcePost: 'qa_social_promo_bonus_post',
  sourceSettlement: 'qa_social_promo_bonus_settlement',
  grant: 'qa_social_promo_bonus_grant',
  targetRaffle: 'qa_raffle_bonus_target_other',
  targetProduct: 'qa_product_bonus_target_other',
};

async function ensureTargetRaffle(otherUserId: string) {
  await prisma.user.update({
    where: { id: otherUserId },
    data: {
      mpConnectStatus: MpConnectStatus.CONNECTED,
      mpUserId: 'qa_mp_other_001',
      mpAccessToken: 'qa_mock_other_access_token',
    },
  });

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 10);

  await prisma.raffle.upsert({
    where: { id: IDS.targetRaffle },
    update: {
      titulo: '[QA] Rifa destino para grant promocional',
      descripcion:
        'Rifa activa creada para probar manualmente grants de promoción social.',
      sellerId: otherUserId,
      totalTickets: 25,
      precioPorTicket: 1250,
      fechaLimiteSorteo: deadline,
      estado: RaffleStatus.ACTIVA,
      deliveryStatus: DeliveryStatus.PENDING,
      isHidden: false,
      isDeleted: false,
      deletedAt: null,
      hiddenReason: null,
    },
    create: {
      id: IDS.targetRaffle,
      titulo: '[QA] Rifa destino para grant promocional',
      descripcion:
        'Rifa activa creada para probar manualmente grants de promoción social.',
      sellerId: otherUserId,
      totalTickets: 25,
      precioPorTicket: 1250,
      fechaLimiteSorteo: deadline,
      estado: RaffleStatus.ACTIVA,
      deliveryStatus: DeliveryStatus.PENDING,
    },
  });

  await prisma.product.upsert({
    where: { raffleId: IDS.targetRaffle },
    update: {
      nombre: '[QA] Producto destino para grant',
      descripcionDetallada:
        'Producto de prueba para validar checkout bonificado con grants.',
      categoria: 'Electronica',
      condicion: ProductCondition.NUEVO,
      imagenes: ['https://picsum.photos/seed/qa-bonus-target/800/600'],
      especificacionesTecnicas: {
        source: 'promotion-bonus-qa-seed',
      },
    },
    create: {
      id: IDS.targetProduct,
      raffleId: IDS.targetRaffle,
      nombre: '[QA] Producto destino para grant',
      descripcionDetallada:
        'Producto de prueba para validar checkout bonificado con grants.',
      categoria: 'Electronica',
      condicion: ProductCondition.NUEVO,
      imagenes: ['https://picsum.photos/seed/qa-bonus-target/800/600'],
      especificacionesTecnicas: {
        source: 'promotion-bonus-qa-seed',
      },
    },
  });
}

async function ensureGrant(sellerId: string) {
  const sourceRaffle = await prisma.raffle.findFirst({
    where: {
      sellerId,
      estado: RaffleStatus.FINALIZADA,
      isDeleted: false,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!sourceRaffle) {
    throw new Error(
      'No se encontró una rifa FINALIZADA del seller QA para crear el settlement fuente.',
    );
  }

  const expiration = new Date();
  expiration.setDate(expiration.getDate() + 30);

  await prisma.promotionBonusRedemption.deleteMany({
    where: { promotionBonusGrantId: IDS.grant },
  });

  await prisma.socialPromotionDraft.upsert({
    where: { id: IDS.sourceDraft },
    update: {
      raffleId: sourceRaffle.id,
      sellerId,
      network: SocialPromotionNetwork.THREADS,
      trackingUrl:
        'http://localhost:3001/social-promotions/track/promo-qa-grant-fixture',
      promotionToken: 'promo-qa-grant-fixture',
      suggestedCopy:
        'Fixture QA de grant promocional. Usado solo para probar bonificaciones.',
      expiresAt: expiration,
    },
    create: {
      id: IDS.sourceDraft,
      raffleId: sourceRaffle.id,
      sellerId,
      network: SocialPromotionNetwork.THREADS,
      trackingUrl:
        'http://localhost:3001/social-promotions/track/promo-qa-grant-fixture',
      promotionToken: 'promo-qa-grant-fixture',
      suggestedCopy:
        'Fixture QA de grant promocional. Usado solo para probar bonificaciones.',
      expiresAt: expiration,
    },
  });

  await prisma.socialPromotionPost.upsert({
    where: { id: IDS.sourcePost },
    update: {
      draftId: IDS.sourceDraft,
      raffleId: sourceRaffle.id,
      sellerId,
      network: SocialPromotionNetwork.THREADS,
      submittedPermalink: 'https://threads.net/@qa/post/promo-qa-grant-fixture',
      canonicalPermalink:
        'https://threads.net/@qa/post/promo-qa-grant-fixture',
      canonicalPostId: 'promo-qa-grant-fixture',
      status: SocialPromotionStatus.SETTLED,
      publishedAt: new Date(),
      validatedAt: new Date(),
      lastCheckedAt: new Date(),
      nextCheckAt: null,
      disqualifiedAt: null,
      disqualificationReason: null,
    },
    create: {
      id: IDS.sourcePost,
      draftId: IDS.sourceDraft,
      raffleId: sourceRaffle.id,
      sellerId,
      network: SocialPromotionNetwork.THREADS,
      submittedPermalink: 'https://threads.net/@qa/post/promo-qa-grant-fixture',
      canonicalPermalink:
        'https://threads.net/@qa/post/promo-qa-grant-fixture',
      canonicalPostId: 'promo-qa-grant-fixture',
      status: SocialPromotionStatus.SETTLED,
      publishedAt: new Date(),
      validatedAt: new Date(),
      lastCheckedAt: new Date(),
    },
  });

  await prisma.promotionScoreSettlement.upsert({
    where: { id: IDS.sourceSettlement },
    update: {
      socialPromotionPostId: IDS.sourcePost,
      sellerId,
      raffleId: sourceRaffle.id,
      baseScore: 10,
      engagementScore: 8,
      conversionScore: 22,
      totalScore: 40,
      settlementStatus: SocialPromotionStatus.SETTLED,
      settledAt: new Date(),
    },
    create: {
      id: IDS.sourceSettlement,
      socialPromotionPostId: IDS.sourcePost,
      sellerId,
      raffleId: sourceRaffle.id,
      baseScore: 10,
      engagementScore: 8,
      conversionScore: 22,
      totalScore: 40,
      settlementStatus: SocialPromotionStatus.SETTLED,
      settledAt: new Date(),
    },
  });

  await prisma.promotionBonusGrant.upsert({
    where: { id: IDS.grant },
    update: {
      sellerId,
      sourceSettlementId: IDS.sourceSettlement,
      discountPercent: 10,
      maxDiscountAmount: 10000,
      expiresAt: expiration,
      status: PromotionBonusGrantStatus.AVAILABLE,
      usedAt: null,
    },
    create: {
      id: IDS.grant,
      sellerId,
      sourceSettlementId: IDS.sourceSettlement,
      discountPercent: 10,
      maxDiscountAmount: 10000,
      expiresAt: expiration,
      status: PromotionBonusGrantStatus.AVAILABLE,
    },
  });
}

async function main() {
  console.log('🌱 Creating QA promotion bonus fixture...');

  const [seller, other] = await Promise.all([
    prisma.user.findUnique({ where: { email: USERS.seller } }),
    prisma.user.findUnique({ where: { email: USERS.other } }),
  ]);

  if (!seller) {
    throw new Error(`No se encontró el usuario seller QA: ${USERS.seller}`);
  }

  if (!other) {
    throw new Error(`No se encontró el usuario destino QA: ${USERS.other}`);
  }

  await ensureTargetRaffle(other.id);
  await ensureGrant(seller.id);

  console.log('✅ QA promotion bonus fixture lista');
  console.log(`- Grant owner: ${USERS.seller}`);
  console.log('- Grant: 10% off hasta $10.000');
  console.log(`- Target raffle id: ${IDS.targetRaffle}`);
  console.log(
    `- Target raffle URL: http://localhost:3000/raffle/${IDS.targetRaffle}`,
  );
}

main()
  .catch((error) => {
    console.error('❌ QA promotion bonus fixture failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  PromotionBonusGrantStatus,
  PromotionBonusRedemptionStatus,
  SocialPromotionAttributionEventType,
  SocialPromotionNetwork as PrismaSocialPromotionNetwork,
  SocialPromotionStatus,
  TransactionType,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { ActivityService } from '../activity/activity.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { captureException } from '../sentry';
import {
  PromotionBonusGrant,
  PromotionBonusGrantStatus as PromotionBonusGrantStatusGql,
  PromotionBonusPreview,
  SocialPromotionAnalyticsRow,
  SocialPromotionDraft,
  SocialPromotionNetwork,
  SocialPromotionPost,
  SocialPromotionStatus as SocialPromotionStatusGql,
} from './entities/social-promotion.entity';
import { SocialPromotionParserService } from './parsers/social-promotion-parser.service';
import { SocialPromotionPageLoaderService } from './social-promotion-page-loader.service';

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

interface ReserveBonusParams {
  buyerId: string;
  raffleId: string;
  raffleSellerId: string;
  reservationId: string;
  grossSubtotal: number;
  bonusGrantId?: string | null;
}

interface BonusTier {
  minScore: number;
  discountPercent: number;
  maxDiscountAmount: number;
}

interface PromotionBonusGrantNotificationContext {
  sellerId: string;
  sellerEmail: string;
  sellerName: string;
  raffleId: string;
  raffleTitle: string;
  postId: string;
  settlementId: string;
  grantId: string;
  discountPercent: number;
  maxDiscountAmount: number;
  expiresAt: Date;
  network: string;
}

interface ValidationAttemptResult {
  loadedPage: {
    html: string;
    finalUrl: string;
    loader: 'fetch' | 'playwright';
  };
  parsed: {
    canonicalPermalink: string;
    canonicalPostId?: string;
    isAccessible: boolean;
    tokenPresent: boolean;
    metrics: {
      likesCount?: number;
      commentsCount?: number;
      repostsOrSharesCount?: number;
      viewsCount?: number;
    };
  };
}

/**
 * Orchestrates verifiable social promotion drafts, validation, settlement, and bonus usage.
 */
@Injectable()
export class SocialPromotionsService {
  private readonly logger = new Logger(SocialPromotionsService.name);
  private readonly retryablePrismaErrorCodes = new Set([
    'P1001',
    'P1002',
    'P1017',
    'P2024',
  ]);
  private readonly tokenTtlHours: number;
  private readonly minProviderCharge: number;
  private readonly frontendUrl: string;
  private readonly backendUrl: string;
  private readonly defaultBonusTiers: BonusTier[];
  private readonly allowedNetworks: Set<SocialPromotionNetwork>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly parser: SocialPromotionParserService,
    private readonly pageLoader: SocialPromotionPageLoaderService,
    private readonly activityService: ActivityService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.tokenTtlHours = this.configService.get<number>(
      'SOCIAL_PROMOTION_TOKEN_TTL_HOURS',
      24,
    );
    this.minProviderCharge = this.configService.get<number>(
      'SOCIAL_PROMOTION_MIN_PROVIDER_CHARGE',
      1,
    );
    this.frontendUrl = this.normalizeBaseUrl(
      this.configService.get<string>('FRONTEND_URL'),
      'http://localhost:3000',
    );
    this.backendUrl = this.normalizeBaseUrl(
      this.configService.get<string>('BACKEND_URL'),
      'http://localhost:3001',
    );
    this.defaultBonusTiers = this.getBonusTiers();
    this.allowedNetworks = this.getAllowedNetworks();
  }

  /**
   * Creates a seller-scoped draft with a Luk tracking link and promotion token.
   */
  async startSocialPromotionDraft(
    sellerId: string,
    raffleId: string,
    network: SocialPromotionNetwork,
  ): Promise<SocialPromotionDraft> {
    if (!this.allowedNetworks.has(network)) {
      throw new BadRequestException(
        'Esta red social no está habilitada para promoción verificable',
      );
    }

    const raffle = await this.prisma.raffle.findUnique({
      where: { id: raffleId },
      select: { id: true, sellerId: true, estado: true, titulo: true },
    });

    if (!raffle) {
      throw new NotFoundException('Rifa no encontrada');
    }
    if (raffle.sellerId !== sellerId) {
      throw new ForbiddenException('No podés promocionar una rifa ajena');
    }
    if (raffle.estado !== 'ACTIVA') {
      throw new BadRequestException('Solo podés promocionar rifas activas');
    }

    const promotionToken = this.generatePromotionToken();
    const trackingUrl = `${this.backendUrl}/social-promotions/track/${promotionToken}`;
    const suggestedCopy = [
      `Estoy compartiendo mi rifa en Luk.`,
      raffle.titulo,
      trackingUrl,
      `Token: ${promotionToken}`,
    ].join(' ');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.tokenTtlHours);

    const draft = await this.prisma.socialPromotionDraft.create({
      data: {
        raffleId,
        sellerId,
        network: network as unknown as PrismaSocialPromotionNetwork,
        trackingUrl,
        promotionToken,
        suggestedCopy,
        expiresAt,
      },
    });

    await this.activityService.logSocialPromotionDraftCreated(
      sellerId,
      draft.id,
      {
        raffleId,
        network,
      },
    );

    return draft as unknown as SocialPromotionDraft;
  }

  /**
   * Registers a submitted public post against a draft and queues it for validation.
   */
  async submitSocialPromotionPost(
    sellerId: string,
    draftId: string,
    permalink: string,
  ): Promise<SocialPromotionPost> {
    const draft = await this.prisma.socialPromotionDraft.findUnique({
      where: { id: draftId },
      include: {
        raffle: { select: { id: true, sellerId: true, estado: true } },
        post: true,
      },
    });

    if (!draft) {
      throw new NotFoundException('Draft promocional no encontrado');
    }
    if (draft.sellerId !== sellerId) {
      throw new ForbiddenException('No podés usar un draft ajeno');
    }
    if (draft.raffle.sellerId !== sellerId) {
      throw new ForbiddenException('No podés promocionar una rifa ajena');
    }
    if (draft.raffle.estado !== 'ACTIVA') {
      throw new BadRequestException('La rifa ya no está activa');
    }
    if (draft.expiresAt < new Date()) {
      throw new BadRequestException('El draft promocional expiró');
    }
    if (draft.post) {
      throw new BadRequestException(
        'Este draft ya tiene una publicación asociada',
      );
    }

    let detectedNetwork: SocialPromotionNetwork;
    let canonicalPermalink: string;

    try {
      detectedNetwork = this.parser.detectNetworkFromUrl(permalink);
      canonicalPermalink = this.parser.canonicalizePermalink(permalink);
    } catch {
      throw new BadRequestException(
        'La URL enviada no es válida para una publicación pública soportada',
      );
    }

    const detectedPrismaNetwork =
      detectedNetwork as unknown as PrismaSocialPromotionNetwork;
    if (detectedPrismaNetwork !== draft.network) {
      throw new BadRequestException(
        'La URL enviada no coincide con la red del draft',
      );
    }

    const post = await this.prisma.socialPromotionPost.create({
      data: {
        draftId: draft.id,
        raffleId: draft.raffleId,
        sellerId,
        network: draft.network,
        submittedPermalink: permalink,
        canonicalPermalink,
        status: SocialPromotionStatus.PENDING_VALIDATION,
        nextCheckAt: new Date(),
      },
      include: {
        snapshots: { orderBy: { checkedAt: 'desc' }, take: 5 },
        settlement: true,
      },
    });

    await this.activityService.logSocialPromotionPostSubmitted(
      sellerId,
      post.id,
      {
        raffleId: draft.raffleId,
        draftId: draft.id,
        network: String(draft.network),
        canonicalPermalink,
      },
    );

    return this.mapSocialPromotionPost(post);
  }

  /**
   * Lists the seller's submitted promotion posts, optionally filtered by raffle.
   */
  async mySocialPromotionPosts(sellerId: string, raffleId?: string) {
    const posts = await this.prisma.socialPromotionPost.findMany({
      where: {
        sellerId,
        raffleId,
      },
      include: {
        snapshots: { orderBy: { checkedAt: 'desc' }, take: 5 },
        settlement: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return posts.map((post) => this.mapSocialPromotionPost(post));
  }

  /**
   * Lists promotion bonus grants earned by the seller.
   */
  async myPromotionBonusGrants(
    sellerId: string,
    status?: PromotionBonusGrantStatus,
  ) {
    const grants = await this.prisma.promotionBonusGrant.findMany({
      where: {
        sellerId,
        status,
      },
      orderBy: { createdAt: 'desc' },
    });

    return grants.map((grant) => this.mapPromotionBonusGrant(grant));
  }

  /**
   * Calculates the promotion bonus preview for a buyer before checkout reservation.
   */
  async previewPromotionBonus(
    buyerId: string,
    raffleId: string,
    cantidad: number,
    bonusGrantId: string,
  ): Promise<PromotionBonusPreview> {
    const raffle = await this.prisma.raffle.findUnique({
      where: { id: raffleId },
      select: { id: true, sellerId: true, precioPorTicket: true, estado: true },
    });

    if (!raffle || raffle.estado !== 'ACTIVA') {
      throw new BadRequestException('La rifa no está disponible');
    }

    const grant = await this.getAvailableGrantForBuyer(buyerId, bonusGrantId);

    if (raffle.sellerId === buyerId) {
      throw new BadRequestException(
        'No podés usar una bonificación en una rifa propia',
      );
    }

    const grossSubtotal = Number(raffle.precioPorTicket) * cantidad;
    return this.buildBonusPreview(grant, grossSubtotal);
  }

  /**
   * Reserves an available promotion bonus and creates a checkout-bound redemption record.
   */
  async reserveBonusForCheckout(
    params: ReserveBonusParams,
    tx?: Prisma.TransactionClient,
  ) {
    if (!params.bonusGrantId) {
      return null;
    }

    if (params.raffleSellerId === params.buyerId) {
      throw new BadRequestException(
        'No podés usar una bonificación en una rifa propia',
      );
    }

    const client = this.getClient(tx);
    const grant = await client.promotionBonusGrant.findFirst({
      where: {
        id: params.bonusGrantId,
        sellerId: params.buyerId,
        status: PromotionBonusGrantStatus.AVAILABLE,
        expiresAt: { gt: new Date() },
      },
    });

    if (!grant) {
      throw new BadRequestException(
        'La bonificación promocional no está disponible',
      );
    }

    const preview = this.buildBonusPreview(grant, params.grossSubtotal);

    await client.promotionBonusGrant.update({
      where: { id: grant.id },
      data: { status: PromotionBonusGrantStatus.RESERVED },
    });

    const redemption = await client.promotionBonusRedemption.create({
      data: {
        promotionBonusGrantId: grant.id,
        buyerId: params.buyerId,
        raffleId: params.raffleId,
        reservationId: params.reservationId,
        grossSubtotal: preview.grossSubtotal,
        discountApplied: preview.discountApplied,
        chargedAmount: preview.chargedAmount,
        status: PromotionBonusRedemptionStatus.RESERVED,
      },
    });

    return {
      grant: this.mapPromotionBonusGrant(grant),
      redemption,
      preview,
    };
  }

  /**
   * Marks a reserved redemption as consumed once the linked payment is approved.
   */
  async markRedemptionUsedByReservation(params: {
    reservationId?: string;
    bonusGrantId?: string | null;
    purchaseReference: string;
  }): Promise<void> {
    if (!params.reservationId || !params.bonusGrantId) {
      return;
    }

    const redemption = await this.prisma.promotionBonusRedemption.findFirst({
      where: {
        reservationId: params.reservationId,
        promotionBonusGrantId: params.bonusGrantId,
        status: PromotionBonusRedemptionStatus.RESERVED,
      },
    });

    if (!redemption) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.promotionBonusRedemption.update({
        where: { id: redemption.id },
        data: {
          status: PromotionBonusRedemptionStatus.USED,
          purchaseReference: params.purchaseReference,
          resolvedAt: new Date(),
        },
      }),
      this.prisma.promotionBonusGrant.update({
        where: { id: redemption.promotionBonusGrantId },
        data: {
          status: PromotionBonusGrantStatus.USED,
          usedAt: new Date(),
        },
      }),
    ]);

    await this.activityService.logSocialPromotionBonusUsed(
      redemption.buyerId,
      redemption.id,
      {
        raffleId: redemption.raffleId,
        grantId: redemption.promotionBonusGrantId,
        discountApplied: Number(redemption.discountApplied),
        cashChargedAmount: Number(redemption.chargedAmount),
      },
    );
  }

  /**
   * Releases reserved bonus redemptions when the checkout does not complete successfully.
   */
  async releaseReservedRedemptionByReservation(
    reservationId: string,
  ): Promise<void> {
    const redemptions = await this.prisma.promotionBonusRedemption.findMany({
      where: {
        reservationId,
        status: PromotionBonusRedemptionStatus.RESERVED,
      },
    });

    for (const redemption of redemptions) {
      await this.prisma.$transaction([
        this.prisma.promotionBonusRedemption.update({
          where: { id: redemption.id },
          data: {
            status: PromotionBonusRedemptionStatus.RELEASED,
            resolvedAt: new Date(),
          },
        }),
        this.prisma.promotionBonusGrant.update({
          where: { id: redemption.promotionBonusGrantId },
          data: {
            status: PromotionBonusGrantStatus.AVAILABLE,
          },
        }),
      ]);
    }
  }

  /**
   * Restores bonus availability after a full refund and records the reversal transaction.
   */
  async reinstateRedemptionByPurchaseReference(
    purchaseReference: string,
    refundAmount?: number,
  ): Promise<void> {
    const redemptions = await this.prisma.promotionBonusRedemption.findMany({
      where: {
        purchaseReference,
        status: PromotionBonusRedemptionStatus.USED,
      },
    });

    for (const redemption of redemptions) {
      const normalizedRefundAmount =
        typeof refundAmount === 'number' && refundAmount > 0
          ? Number(refundAmount.toFixed(2))
          : null;
      const chargedAmount = Number(redemption.chargedAmount);
      const isFullRefund =
        normalizedRefundAmount === null ||
        normalizedRefundAmount >= Number((chargedAmount - 0.01).toFixed(2));

      if (!isFullRefund) {
        this.logger.log(
          `Keeping promotion bonus grant ${redemption.promotionBonusGrantId} in USED after partial refund ${normalizedRefundAmount} for purchase ${purchaseReference}`,
        );
        continue;
      }

      await this.prisma.$transaction([
        this.prisma.promotionBonusRedemption.update({
          where: { id: redemption.id },
          data: {
            status: PromotionBonusRedemptionStatus.REVERSED,
            resolvedAt: new Date(),
          },
        }),
        this.prisma.promotionBonusGrant.update({
          where: { id: redemption.promotionBonusGrantId },
          data: {
            status: PromotionBonusGrantStatus.AVAILABLE,
            usedAt: null,
          },
        }),
        this.prisma.transaction.create({
          data: {
            tipo: TransactionType.REVERSION_BONIFICACION_PROMOCIONAL,
            userId: redemption.buyerId,
            raffleId: redemption.raffleId,
            monto: redemption.discountApplied,
            grossAmount: redemption.grossSubtotal,
            promotionDiscountAmount: redemption.discountApplied,
            cashChargedAmount: redemption.chargedAmount,
            estado: 'COMPLETADO',
            metadata: {
              promotionBonusGrantId: redemption.promotionBonusGrantId,
              promotionBonusRedemptionId: redemption.id,
              purchaseReference,
              refundAmount: normalizedRefundAmount ?? chargedAmount,
              refundType:
                normalizedRefundAmount === null ? 'full' : 'full-equivalent',
              reason: 'payment_refunded',
            },
          },
        }),
      ]);

      await this.activityService.logSocialPromotionBonusReversed(
        redemption.buyerId,
        redemption.id,
        {
          raffleId: redemption.raffleId,
          grantId: redemption.promotionBonusGrantId,
          refundAmount: normalizedRefundAmount ?? chargedAmount,
          discountApplied: Number(redemption.discountApplied),
        },
      );
    }
  }

  /**
   * Processes posts that are pending validation or due for a scheduled re-check.
   */
  async processDueSocialPromotionPosts(): Promise<number> {
    const posts = await this.withPrismaReconnect(
      'load due social promotion posts',
      () =>
        this.prisma.socialPromotionPost.findMany({
          where: {
            OR: [
              { status: SocialPromotionStatus.PENDING_VALIDATION },
              { status: SocialPromotionStatus.TECHNICAL_REVIEW },
              {
                status: SocialPromotionStatus.ACTIVE,
                nextCheckAt: { lte: new Date() },
              },
            ],
          },
          take: 25,
          orderBy: { submittedAt: 'asc' },
        }),
    );

    let processed = 0;
    for (const post of posts) {
      try {
        await this.validateSocialPromotionPost(post.id);
        processed += 1;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Unhandled validation failure for promotion post ${post.id}: ${message}`,
        );
        this.captureSocialPromotionException(error, {
          stage: 'validation',
          service: 'luk-backend',
          postId: post.id,
        });
      }
    }

    return processed;
  }

  /**
   * Settles eligible promotion posts once their raffle has effectively closed.
   */
  async settleClosedSocialPromotionPosts(): Promise<number> {
    const posts = await this.withPrismaReconnect(
      'load closed social promotion posts',
      () =>
        this.prisma.socialPromotionPost.findMany({
          where: {
            status: {
              in: [
                SocialPromotionStatus.ACTIVE,
                SocialPromotionStatus.TECHNICAL_REVIEW,
              ],
            },
            settlement: null,
            raffle: {
              estado: {
                in: ['COMPLETADA', 'SORTEADA', 'EN_ENTREGA', 'FINALIZADA'],
              },
            },
          },
          include: {
            snapshots: { orderBy: { checkedAt: 'desc' }, take: 1 },
            raffle: true,
          },
        }),
    );

    let settled = 0;
    for (const post of posts) {
      try {
        await this.settleSocialPromotionPost(post.id);
        settled += 1;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Unhandled settlement failure for promotion post ${post.id}: ${message}`,
        );
        this.captureSocialPromotionException(error, {
          stage: 'settlement',
          service: 'luk-backend',
          postId: post.id,
          raffleId: post.raffleId,
          userId: post.sellerId,
        });
      }
    }

    return settled;
  }

  /**
   * Loads a submitted public post, captures metrics, and updates its validation status.
   */
  async validateSocialPromotionPost(postId: string): Promise<void> {
    const post = await this.withPrismaReconnect(
      `load promotion post ${postId}`,
      () =>
        this.prisma.socialPromotionPost.findUnique({
          where: { id: postId },
          include: {
            draft: true,
            raffle: { select: { id: true, estado: true } },
          },
        }),
    );

    if (!post) {
      throw new NotFoundException('Publicación promocional no encontrada');
    }

    try {
      const network = post.network as unknown as SocialPromotionNetwork;
      const initialAttempt = await this.loadAndParsePromotionPost({
        network,
        permalink: post.submittedPermalink,
        promotionToken: post.draft.promotionToken,
        trackingUrl: post.draft.trackingUrl,
      });
      const validationAttempt = await this.retryWithBrowserForVisibleMetrics({
        network,
        permalink: post.submittedPermalink,
        promotionToken: post.draft.promotionToken,
        trackingUrl: post.draft.trackingUrl,
        initialAttempt,
      });
      const { loadedPage, parsed } = validationAttempt;
      const attributedMetrics = await this.withPrismaReconnect(
        `load attributed metrics for promotion post ${post.id}`,
        () => this.getAttributedMetrics(post.id),
      );

      const nextCheckAt = new Date();
      nextCheckAt.setHours(nextCheckAt.getHours() + 6);

      const nextStatus = !parsed.isAccessible
        ? SocialPromotionStatus.DISQUALIFIED
        : !parsed.tokenPresent
          ? SocialPromotionStatus.DISQUALIFIED
          : SocialPromotionStatus.ACTIVE;

      const disqualificationReason = !parsed.isAccessible
        ? 'La publicación no es accesible públicamente'
        : !parsed.tokenPresent
          ? 'No se detectó el token o trackingUrl de Luk'
          : null;

      await this.withPrismaReconnect(
        `persist validation result for promotion post ${post.id}`,
        () =>
          this.prisma.$transaction([
            this.prisma.socialPromotionMetricSnapshot.create({
              data: {
                socialPromotionPostId: post.id,
                isAccessible: parsed.isAccessible,
                tokenPresent: parsed.tokenPresent,
                likesCount: parsed.metrics.likesCount,
                commentsCount: parsed.metrics.commentsCount,
                repostsOrSharesCount: parsed.metrics.repostsOrSharesCount,
                viewsCount: parsed.metrics.viewsCount,
                clicksAttributed: attributedMetrics.clicksAttributed,
                registrationsAttributed:
                  attributedMetrics.registrationsAttributed,
                ticketPurchasesAttributed:
                  attributedMetrics.ticketPurchasesAttributed,
                rawEvidenceMeta: {
                  loader: loadedPage.loader,
                  canonicalPermalink: parsed.canonicalPermalink,
                  metricsDetected: this.hasVisibleMetrics(parsed.metrics),
                },
                parserVersion: 'v1',
                failureReason: disqualificationReason ?? undefined,
              },
            }),
            this.prisma.socialPromotionPost.update({
              where: { id: post.id },
              data: {
                canonicalPermalink: parsed.canonicalPermalink,
                canonicalPostId: parsed.canonicalPostId,
                status: nextStatus,
                validatedAt: post.validatedAt ?? new Date(),
                lastCheckedAt: new Date(),
                nextCheckAt:
                  nextStatus === SocialPromotionStatus.ACTIVE
                    ? nextCheckAt
                    : null,
                disqualifiedAt:
                  nextStatus === SocialPromotionStatus.DISQUALIFIED
                    ? new Date()
                    : null,
                disqualificationReason:
                  nextStatus === SocialPromotionStatus.DISQUALIFIED
                    ? disqualificationReason
                    : null,
              },
            }),
          ]),
      );

      if (nextStatus === SocialPromotionStatus.DISQUALIFIED) {
        await this.activityService.logSocialPromotionPostDisqualified(
          post.sellerId,
          post.id,
          {
            raffleId: post.raffleId,
            network: String(post.network),
            reason:
              disqualificationReason ?? 'La publicación no pudo validarse',
            disqualifiedBy: 'system',
          },
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Failed to validate promotion post ${post.id}: ${message}`,
      );
      this.captureSocialPromotionException(error, {
        stage: 'validation',
        service: 'luk-backend',
        postId: post.id,
        raffleId: post.raffleId,
        userId: post.sellerId,
        network: String(post.network),
      });

      await this.withPrismaReconnect(
        `persist technical review for promotion post ${post.id}`,
        () =>
          this.prisma.$transaction([
            this.prisma.socialPromotionMetricSnapshot.create({
              data: {
                socialPromotionPostId: post.id,
                isAccessible: false,
                tokenPresent: false,
                clicksAttributed: 0,
                registrationsAttributed: 0,
                ticketPurchasesAttributed: 0,
                parserVersion: 'v1',
                failureReason: message,
              },
            }),
            this.prisma.socialPromotionPost.update({
              where: { id: post.id },
              data: {
                status: SocialPromotionStatus.TECHNICAL_REVIEW,
                lastCheckedAt: new Date(),
                nextCheckAt: new Date(Date.now() + 60 * 60 * 1000),
                disqualificationReason: null,
              },
            }),
          ]),
      );
    }
  }

  /**
   * Computes the final promotion score and issues a seller bonus grant when a tier matches.
   */
  async settleSocialPromotionPost(postId: string): Promise<void> {
    const post = await this.withPrismaReconnect(
      `load settlement candidate ${postId}`,
      () =>
        this.prisma.socialPromotionPost.findUnique({
          where: { id: postId },
          include: {
            snapshots: { orderBy: { checkedAt: 'desc' }, take: 1 },
            settlement: true,
            raffle: {
              select: {
                id: true,
                titulo: true,
              },
            },
            seller: {
              select: {
                id: true,
                email: true,
                nombre: true,
              },
            },
          },
        }),
    );

    if (!post || post.settlement) {
      return;
    }

    const latestSnapshot = post.snapshots[0];
    if (
      !latestSnapshot ||
      !latestSnapshot.isAccessible ||
      !latestSnapshot.tokenPresent
    ) {
      await this.withPrismaReconnect(
        `disqualify unsettled promotion post ${post.id}`,
        () =>
          this.prisma.socialPromotionPost.update({
            where: { id: post.id },
            data: {
              status: SocialPromotionStatus.DISQUALIFIED,
              disqualifiedAt: post.disqualifiedAt ?? new Date(),
              nextCheckAt: null,
            },
          }),
      );
      return;
    }

    const baseScore = 10;
    const engagementScore =
      (latestSnapshot.likesCount ?? 0) * 0.01 +
      (latestSnapshot.commentsCount ?? 0) * 0.25 +
      (latestSnapshot.repostsOrSharesCount ?? 0) * 0.5 +
      (latestSnapshot.viewsCount ?? 0) * 0.001;
    const conversionScore =
      latestSnapshot.clicksAttributed * 0.1 +
      latestSnapshot.registrationsAttributed * 3 +
      latestSnapshot.ticketPurchasesAttributed * 1.5;
    const totalScore = Number(
      (baseScore + engagementScore + conversionScore).toFixed(2),
    );

    const settlement = await this.withPrismaReconnect(
      `create settlement for promotion post ${post.id}`,
      () =>
        this.prisma.promotionScoreSettlement.create({
          data: {
            socialPromotionPostId: post.id,
            sellerId: post.sellerId,
            raffleId: post.raffleId,
            baseScore,
            engagementScore,
            conversionScore,
            totalScore,
          },
        }),
    );

    const tier = this.defaultBonusTiers.find(
      (candidate) => totalScore >= candidate.minScore,
    );
    let createdGrant:
      | {
          id: string;
          discountPercent: Prisma.Decimal;
          maxDiscountAmount: Prisma.Decimal;
          expiresAt: Date;
        }
      | undefined;
    if (tier) {
      createdGrant = await this.withPrismaReconnect(
        `create bonus grant for promotion post ${post.id}`,
        () =>
          this.prisma.promotionBonusGrant.create({
            data: {
              sellerId: post.sellerId,
              sourceSettlementId: settlement.id,
              discountPercent: tier.discountPercent,
              maxDiscountAmount: tier.maxDiscountAmount,
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          }),
      );
    }

    await this.withPrismaReconnect(
      `mark promotion post ${post.id} as settled`,
      () =>
        this.prisma.socialPromotionPost.update({
          where: { id: post.id },
          data: {
            status: SocialPromotionStatus.SETTLED,
            nextCheckAt: null,
          },
        }),
    );

    await this.activityService.logSocialPromotionSettled(
      post.sellerId,
      post.id,
      {
        raffleId: post.raffleId,
        settlementId: settlement.id,
        score: totalScore,
        tier: tier
          ? `${tier.discountPercent}%/${tier.maxDiscountAmount}`
          : undefined,
        network: String(post.network),
      },
    );

    if (createdGrant) {
      await this.activityService.logSocialPromotionGrantIssued(
        post.sellerId,
        createdGrant.id,
        {
          postId: post.id,
          raffleId: post.raffleId,
          settlementId: settlement.id,
          score: totalScore,
          tier: `${tier?.discountPercent}%/${tier?.maxDiscountAmount}`,
          discountPercent: Number(createdGrant.discountPercent),
          maxDiscountAmount: Number(createdGrant.maxDiscountAmount),
          network: String(post.network),
        },
      );

      await this.notifyPromotionBonusGrantIssued({
        sellerId: post.seller.id,
        sellerEmail: post.seller.email,
        sellerName: post.seller.nombre || post.seller.email.split('@')[0],
        raffleId: post.raffle.id,
        raffleTitle: post.raffle.titulo,
        postId: post.id,
        settlementId: settlement.id,
        grantId: createdGrant.id,
        discountPercent: Number(createdGrant.discountPercent),
        maxDiscountAmount: Number(createdGrant.maxDiscountAmount),
        expiresAt: createdGrant.expiresAt,
        network: String(post.network),
      });
    }
  }

  /**
   * Records a click attribution event when the token resolves to a known promotion.
   */
  async trackPromotionClickByToken(token: string): Promise<string> {
    const draft = await this.prisma.socialPromotionDraft.findUnique({
      where: { promotionToken: token },
      include: {
        raffle: { select: { id: true } },
        post: true,
      },
    });

    if (!draft) {
      return `${this.frontendUrl}/search`;
    }

    if (draft.post) {
      await this.prisma.socialPromotionAttributionEvent.create({
        data: {
          socialPromotionPostId: draft.post.id,
          eventType: SocialPromotionAttributionEventType.CLICK,
          metadata: { source: 'tracking-link' },
        },
      });
    }

    return `${this.frontendUrl}/raffle/${draft.raffleId}?promo=${token}`;
  }

  /**
   * Stores a registration attribution event once per user and promotion token.
   */
  async recordRegistrationAttribution(
    userId: string,
    promotionToken?: string | null,
  ): Promise<void> {
    if (!promotionToken) return;

    const post = await this.findPostByPromotionToken(promotionToken);
    if (!post) return;

    const existing =
      await this.prisma.socialPromotionAttributionEvent.findFirst({
        where: {
          socialPromotionPostId: post.id,
          userId,
          eventType: SocialPromotionAttributionEventType.REGISTRATION,
        },
        select: { id: true },
      });
    if (existing) return;

    await this.prisma.socialPromotionAttributionEvent.create({
      data: {
        socialPromotionPostId: post.id,
        userId,
        eventType: SocialPromotionAttributionEventType.REGISTRATION,
      },
    });
  }

  /**
   * Stores purchase attribution for a promotion-driven ticket purchase.
   */
  async recordPurchaseAttribution(
    userId: string,
    promotionToken: string | undefined,
    ticketCount: number,
    amount: number,
  ): Promise<void> {
    if (!promotionToken) return;

    const post = await this.findPostByPromotionToken(promotionToken);
    if (!post) return;

    await this.prisma.socialPromotionAttributionEvent.create({
      data: {
        socialPromotionPostId: post.id,
        userId,
        eventType: SocialPromotionAttributionEventType.PURCHASE,
        ticketCount,
        amount,
      },
    });
  }

  /**
   * Returns posts currently blocked in technical review.
   */
  async getTechnicalReviewQueue(): Promise<SocialPromotionPost[]> {
    const posts = await this.prisma.socialPromotionPost.findMany({
      where: { status: SocialPromotionStatus.TECHNICAL_REVIEW },
      include: {
        snapshots: { orderBy: { checkedAt: 'desc' }, take: 5 },
        settlement: true,
      },
      orderBy: { lastCheckedAt: 'asc' },
    });

    return posts.map((post) => this.mapSocialPromotionPost(post));
  }

  /**
   * Returns admin-facing analytics rows built from the latest snapshot and any settlement/grant.
   */
  async getSocialPromotionAnalytics(): Promise<SocialPromotionAnalyticsRow[]> {
    const posts = await this.prisma.socialPromotionPost.findMany({
      include: {
        raffle: {
          select: {
            id: true,
            titulo: true,
          },
        },
        seller: {
          select: {
            id: true,
            email: true,
          },
        },
        snapshots: { orderBy: { checkedAt: 'desc' }, take: 1 },
        settlement: true,
      },
      orderBy: { submittedAt: 'desc' },
    });

    const settlementIds = posts
      .map((post) => post.settlement?.id)
      .filter((id): id is string => Boolean(id));

    const grants =
      settlementIds.length > 0
        ? await this.prisma.promotionBonusGrant.findMany({
            where: {
              sourceSettlementId: {
                in: settlementIds,
              },
            },
          })
        : [];

    const grantsBySettlementId = new Map(
      grants.map((grant) => [grant.sourceSettlementId, grant]),
    );

    return posts.map((post) =>
      this.mapSocialPromotionAnalyticsRow(
        post,
        post.settlement
          ? grantsBySettlementId.get(post.settlement.id)
          : undefined,
      ),
    );
  }

  /**
   * Moves a technical-review post back to pending validation.
   */
  async retryTechnicalReview(
    postId: string,
    adminId?: string,
  ): Promise<SocialPromotionPost> {
    const previous = await this.prisma.socialPromotionPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        raffleId: true,
        sellerId: true,
        status: true,
        network: true,
      },
    });

    const updated = await this.prisma.socialPromotionPost.update({
      where: { id: postId },
      data: {
        status: SocialPromotionStatus.PENDING_VALIDATION,
        nextCheckAt: new Date(),
      },
      include: {
        snapshots: { orderBy: { checkedAt: 'desc' }, take: 5 },
        settlement: true,
      },
    });

    if (adminId && previous) {
      await this.auditService.logSocialPromotionRetried(adminId, postId, {
        raffleId: previous.raffleId,
        sellerId: previous.sellerId,
        network: String(previous.network),
        previousStatus: previous.status,
      });
    }

    return this.mapSocialPromotionPost(updated);
  }

  /**
   * Force-disqualifies a post and stores the admin reason.
   */
  async adminDisqualifyPost(
    postId: string,
    reason: string,
    adminId?: string,
  ): Promise<SocialPromotionPost> {
    const previous = await this.prisma.socialPromotionPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        raffleId: true,
        sellerId: true,
        status: true,
        network: true,
      },
    });

    const updated = await this.prisma.socialPromotionPost.update({
      where: { id: postId },
      data: {
        status: SocialPromotionStatus.DISQUALIFIED,
        disqualifiedAt: new Date(),
        disqualificationReason: reason,
        nextCheckAt: null,
      },
      include: {
        snapshots: { orderBy: { checkedAt: 'desc' }, take: 5 },
        settlement: true,
      },
    });

    if (previous) {
      await this.activityService.logSocialPromotionPostDisqualified(
        previous.sellerId,
        postId,
        {
          raffleId: previous.raffleId,
          network: String(previous.network),
          reason,
          disqualifiedBy: 'admin',
        },
      );
    }

    if (adminId && previous) {
      await this.auditService.logSocialPromotionDisqualified(
        adminId,
        postId,
        reason,
        {
          raffleId: previous.raffleId,
          sellerId: previous.sellerId,
          network: String(previous.network),
          previousStatus: previous.status,
        },
      );
    }

    return this.mapSocialPromotionPost(updated);
  }

  private async findPostByPromotionToken(token: string) {
    return this.prisma.socialPromotionPost.findFirst({
      where: {
        draft: { promotionToken: token },
      },
      select: { id: true },
    });
  }

  private async getAvailableGrantForBuyer(
    buyerId: string,
    bonusGrantId: string,
  ) {
    const grant = await this.prisma.promotionBonusGrant.findFirst({
      where: {
        id: bonusGrantId,
        sellerId: buyerId,
        status: PromotionBonusGrantStatus.AVAILABLE,
        expiresAt: { gt: new Date() },
      },
    });

    if (!grant) {
      throw new BadRequestException(
        'La bonificación promocional no está disponible',
      );
    }

    return grant;
  }

  /**
   * Calculates the capped discount and remaining live-provider charge for a grant.
   */
  private buildBonusPreview(
    grant: {
      id: string;
      discountPercent: Prisma.Decimal | number;
      maxDiscountAmount: Prisma.Decimal | number;
    },
    grossSubtotal: number,
  ): PromotionBonusPreview {
    const discountPercent = Number(grant.discountPercent);
    const maxDiscountAmount = Number(grant.maxDiscountAmount);
    const uncappedDiscount = Number(
      ((grossSubtotal * discountPercent) / 100).toFixed(2),
    );
    const maximumAllowedDiscount = Number(
      Math.max(grossSubtotal - this.minProviderCharge, 0).toFixed(2),
    );
    const discountApplied = Number(
      Math.min(
        uncappedDiscount,
        maxDiscountAmount,
        maximumAllowedDiscount,
      ).toFixed(2),
    );

    if (grossSubtotal <= this.minProviderCharge) {
      throw new BadRequestException(
        'El monto de la compra es demasiado bajo para aplicar bonificación',
      );
    }

    return {
      bonusGrantId: grant.id,
      grossSubtotal: Number(grossSubtotal.toFixed(2)),
      discountApplied,
      chargedAmount: Number((grossSubtotal - discountApplied).toFixed(2)),
    };
  }

  private async getAttributedMetrics(postId: string) {
    const events = await this.prisma.socialPromotionAttributionEvent.findMany({
      where: { socialPromotionPostId: postId },
      select: {
        eventType: true,
        ticketCount: true,
      },
    });

    return {
      clicksAttributed: events.filter(
        (event) =>
          event.eventType === SocialPromotionAttributionEventType.CLICK,
      ).length,
      registrationsAttributed: events.filter(
        (event) =>
          event.eventType === SocialPromotionAttributionEventType.REGISTRATION,
      ).length,
      ticketPurchasesAttributed: events
        .filter(
          (event) =>
            event.eventType === SocialPromotionAttributionEventType.PURCHASE,
        )
        .reduce((total, event) => total + (event.ticketCount ?? 0), 0),
    };
  }

  private async loadAndParsePromotionPost(params: {
    network: SocialPromotionNetwork;
    permalink: string;
    promotionToken: string;
    trackingUrl: string;
    preferBrowser?: boolean;
  }): Promise<ValidationAttemptResult> {
    const loadedPage = await this.pageLoader.loadPublicPage(params.permalink, {
      preferBrowser: params.preferBrowser,
    });
    const parsed = this.parser.parsePublicContent({
      network: params.network,
      rawUrl: loadedPage.finalUrl || params.permalink,
      html: loadedPage.html,
      promotionToken: params.promotionToken,
      trackingUrl: params.trackingUrl,
    });

    return { loadedPage, parsed };
  }

  /**
   * Retries validation with Playwright when the fetch pass lacks usable visible metrics.
   */
  private async retryWithBrowserForVisibleMetrics(params: {
    network: SocialPromotionNetwork;
    permalink: string;
    promotionToken: string;
    trackingUrl: string;
    initialAttempt: ValidationAttemptResult;
  }): Promise<ValidationAttemptResult> {
    const { initialAttempt } = params;

    if (
      initialAttempt.loadedPage.loader === 'playwright' ||
      !initialAttempt.parsed.isAccessible ||
      !initialAttempt.parsed.tokenPresent ||
      this.hasVisibleMetrics(initialAttempt.parsed.metrics)
    ) {
      return initialAttempt;
    }

    try {
      const browserAttempt = await this.loadAndParsePromotionPost({
        network: params.network,
        permalink: params.permalink,
        promotionToken: params.promotionToken,
        trackingUrl: params.trackingUrl,
        preferBrowser: true,
      });

      if (this.shouldUseBrowserAttempt(initialAttempt, browserAttempt)) {
        return browserAttempt;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Browser retry failed for promotion post ${params.permalink}: ${message}`,
      );
      this.captureSocialPromotionException(error, {
        stage: 'validation',
        service: 'luk-backend',
      });
    }

    return initialAttempt;
  }

  /**
   * Chooses whether the browser retry improved the validation result enough to replace the first pass.
   */
  private shouldUseBrowserAttempt(
    currentAttempt: ValidationAttemptResult,
    browserAttempt: ValidationAttemptResult,
  ): boolean {
    if (
      !browserAttempt.parsed.isAccessible &&
      currentAttempt.parsed.isAccessible
    ) {
      return false;
    }

    if (
      !browserAttempt.parsed.tokenPresent &&
      currentAttempt.parsed.tokenPresent
    ) {
      return false;
    }

    const currentHasMetrics = this.hasVisibleMetrics(
      currentAttempt.parsed.metrics,
    );
    const browserHasMetrics = this.hasVisibleMetrics(
      browserAttempt.parsed.metrics,
    );

    if (browserHasMetrics && !currentHasMetrics) {
      return true;
    }

    if (
      browserAttempt.loadedPage.loader === 'playwright' &&
      browserAttempt.parsed.canonicalPermalink !==
        currentAttempt.parsed.canonicalPermalink
    ) {
      return true;
    }

    return false;
  }

  private hasVisibleMetrics(metrics: {
    likesCount?: number;
    commentsCount?: number;
    repostsOrSharesCount?: number;
    viewsCount?: number;
  }): boolean {
    return [
      metrics.likesCount,
      metrics.commentsCount,
      metrics.repostsOrSharesCount,
      metrics.viewsCount,
    ].some((value) => typeof value === 'number');
  }

  /**
   * Retries a Prisma operation once after reconnecting when the failure looks transient.
   */
  private async withPrismaReconnect<T>(
    context: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!this.isRetryablePrismaConnectionError(error)) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Retrying ${context} after Prisma connection error: ${message}`,
      );

      await Promise.resolve(this.prisma.$disconnect()).catch(
        (disconnectError) => {
          const disconnectMessage =
            disconnectError instanceof Error
              ? disconnectError.message
              : 'Unknown disconnect error';
          this.logger.warn(
            `Failed to disconnect Prisma client before retrying ${context}: ${disconnectMessage}`,
          );
        },
      );

      await Promise.resolve(this.prisma.$connect());
      return operation();
    }
  }

  private isRetryablePrismaConnectionError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const maybeCode =
      'code' in error && typeof error.code === 'string' ? error.code : null;
    if (maybeCode && this.retryablePrismaErrorCodes.has(maybeCode)) {
      return true;
    }

    const message =
      'message' in error && typeof error.message === 'string'
        ? error.message.toLowerCase()
        : '';

    return (
      message.includes('server has closed the connection') ||
      message.includes('connection terminated unexpectedly') ||
      message.includes("can't reach database server") ||
      message.includes('connection pool timeout')
    );
  }

  private captureSocialPromotionException(
    error: unknown,
    context: {
      stage: 'validation' | 'settlement' | 'grant-notification';
      service: 'luk-backend' | 'social-worker';
      postId?: string;
      raffleId?: string;
      userId?: string;
      network?: string;
      grantId?: string;
      settlementId?: string;
      notificationChannel?: 'email' | 'in-app';
    },
  ): void {
    const normalizedError =
      error instanceof Error
        ? error
        : new Error('Unknown social promotion error');

    captureException(normalizedError, {
      user: context.userId ? { id: context.userId } : undefined,
      tags: {
        service: context.service,
        domain: 'social-promotions',
        stage: context.stage,
        ...(context.postId ? { postId: context.postId } : {}),
        ...(context.raffleId ? { raffleId: context.raffleId } : {}),
        ...(context.network ? { network: context.network } : {}),
        ...(context.grantId ? { grantId: context.grantId } : {}),
        ...(context.notificationChannel
          ? { notificationChannel: context.notificationChannel }
          : {}),
      },
      extra: {
        postId: context.postId,
        raffleId: context.raffleId,
        network: context.network,
        grantId: context.grantId,
        settlementId: context.settlementId,
        notificationChannel: context.notificationChannel,
      },
    });
  }

  private async notifyPromotionBonusGrantIssued(
    context: PromotionBonusGrantNotificationContext,
  ): Promise<void> {
    const inAppMessage = this.buildPromotionBonusGrantMessage({
      discountPercent: context.discountPercent,
      maxDiscountAmount: context.maxDiscountAmount,
      expiresAt: context.expiresAt,
    });

    const results = await Promise.allSettled([
      this.notificationsService.create(
        context.sellerId,
        'SOCIAL_PROMOTION_GRANT_ISSUED',
        'Ganaste una bonificación promocional',
        inAppMessage,
        '/dashboard/tickets',
      ),
      this.notificationsService
        .sendPromotionBonusGrantIssuedEmail(context.sellerEmail, {
          userName: context.sellerName,
          raffleName: context.raffleTitle,
          discountPercent: context.discountPercent,
          maxDiscountAmount: context.maxDiscountAmount,
          expiresAt: context.expiresAt,
        })
        .then((sent) => {
          if (!sent) {
            throw new Error(
              'Promotion bonus grant email delivery returned false',
            );
          }
        }),
    ]);

    const channels: Array<'in-app' | 'email'> = ['in-app', 'email'];
    for (const [index, result] of results.entries()) {
      if (result.status !== 'rejected') {
        continue;
      }

      const channel = channels[index];
      const message =
        result.reason instanceof Error
          ? result.reason.message
          : 'Unknown promotion bonus grant notification error';

      this.logger.error(
        `Failed to send ${channel} notification for promotion bonus grant ${context.grantId}: ${message}`,
      );
      this.captureSocialPromotionException(result.reason, {
        stage: 'grant-notification',
        service: 'luk-backend',
        postId: context.postId,
        raffleId: context.raffleId,
        userId: context.sellerId,
        network: context.network,
        grantId: context.grantId,
        settlementId: context.settlementId,
        notificationChannel: channel,
      });
    }
  }

  private mapSocialPromotionPost(post: {
    id: string;
    draftId: string;
    raffleId: string;
    sellerId: string;
    network: PrismaSocialPromotionNetwork;
    submittedPermalink: string;
    canonicalPermalink: string | null;
    canonicalPostId: string | null;
    status: SocialPromotionStatus;
    publishedAt: Date | null;
    submittedAt: Date;
    validatedAt: Date | null;
    lastCheckedAt: Date | null;
    nextCheckAt: Date | null;
    disqualifiedAt: Date | null;
    disqualificationReason: string | null;
    snapshots?: Array<{
      id: string;
      socialPromotionPostId: string;
      checkedAt: Date;
      isAccessible: boolean;
      tokenPresent: boolean;
      likesCount: number | null;
      commentsCount: number | null;
      repostsOrSharesCount: number | null;
      viewsCount: number | null;
      clicksAttributed: number;
      registrationsAttributed: number;
      ticketPurchasesAttributed: number;
      parserVersion: string | null;
      failureReason: string | null;
    }>;
    settlement?: {
      id: string;
      socialPromotionPostId: string;
      sellerId: string;
      raffleId: string;
      baseScore: Prisma.Decimal;
      engagementScore: Prisma.Decimal;
      conversionScore: Prisma.Decimal;
      totalScore: Prisma.Decimal;
      settlementStatus: SocialPromotionStatus;
      settledAt: Date;
    } | null;
  }): SocialPromotionPost {
    return {
      ...post,
      network: post.network as unknown as SocialPromotionNetwork,
      status: post.status as unknown as SocialPromotionStatusGql,
      canonicalPermalink: post.canonicalPermalink ?? undefined,
      canonicalPostId: post.canonicalPostId ?? undefined,
      publishedAt: post.publishedAt ?? undefined,
      validatedAt: post.validatedAt ?? undefined,
      lastCheckedAt: post.lastCheckedAt ?? undefined,
      nextCheckAt: post.nextCheckAt ?? undefined,
      disqualifiedAt: post.disqualifiedAt ?? undefined,
      disqualificationReason: post.disqualificationReason ?? undefined,
      snapshots:
        post.snapshots?.map((snapshot) => ({
          ...snapshot,
          likesCount: snapshot.likesCount ?? undefined,
          commentsCount: snapshot.commentsCount ?? undefined,
          repostsOrSharesCount: snapshot.repostsOrSharesCount ?? undefined,
          viewsCount: snapshot.viewsCount ?? undefined,
          parserVersion: snapshot.parserVersion ?? undefined,
          failureReason: snapshot.failureReason ?? undefined,
        })) ?? [],
      settlement: post.settlement
        ? {
            ...post.settlement,
            baseScore: Number(post.settlement.baseScore),
            engagementScore: Number(post.settlement.engagementScore),
            conversionScore: Number(post.settlement.conversionScore),
            totalScore: Number(post.settlement.totalScore),
            settlementStatus: post.settlement
              .settlementStatus as unknown as SocialPromotionStatusGql,
          }
        : undefined,
    };
  }

  private mapPromotionBonusGrant(grant: {
    id: string;
    sellerId: string;
    sourceSettlementId: string;
    discountPercent: Prisma.Decimal;
    maxDiscountAmount: Prisma.Decimal;
    expiresAt: Date;
    status: PromotionBonusGrantStatus;
    createdAt: Date;
    usedAt: Date | null;
  }): PromotionBonusGrant {
    return {
      ...grant,
      discountPercent: Number(grant.discountPercent),
      maxDiscountAmount: Number(grant.maxDiscountAmount),
      status: grant.status as unknown as PromotionBonusGrantStatusGql,
      usedAt: grant.usedAt ?? undefined,
    };
  }

  private mapSocialPromotionAnalyticsRow(
    post: {
      id: string;
      raffleId: string;
      sellerId: string;
      network: PrismaSocialPromotionNetwork;
      status: SocialPromotionStatus;
      submittedPermalink: string;
      canonicalPermalink: string | null;
      submittedAt: Date;
      validatedAt: Date | null;
      raffle: {
        id: string;
        titulo: string;
      };
      seller: {
        id: string;
        email: string;
      };
      snapshots: Array<{
        likesCount: number | null;
        commentsCount: number | null;
        repostsOrSharesCount: number | null;
        viewsCount: number | null;
        clicksAttributed: number;
        registrationsAttributed: number;
        ticketPurchasesAttributed: number;
      }>;
      settlement?: {
        id: string;
        settledAt: Date;
        engagementScore: Prisma.Decimal;
        conversionScore: Prisma.Decimal;
        totalScore: Prisma.Decimal;
      } | null;
    },
    grant?: {
      discountPercent: Prisma.Decimal;
      maxDiscountAmount: Prisma.Decimal;
      status: PromotionBonusGrantStatus;
    },
  ): SocialPromotionAnalyticsRow {
    const latestSnapshot = post.snapshots[0];

    return {
      postId: post.id,
      raffleId: post.raffleId,
      raffleTitle: post.raffle.titulo,
      sellerId: post.sellerId,
      sellerEmail: post.seller.email,
      network: post.network as unknown as SocialPromotionNetwork,
      status: post.status as unknown as SocialPromotionStatusGql,
      submittedPermalink: post.submittedPermalink,
      canonicalPermalink: post.canonicalPermalink ?? undefined,
      submittedAt: post.submittedAt,
      validatedAt: post.validatedAt ?? undefined,
      settledAt: post.settlement?.settledAt ?? undefined,
      likesCount: latestSnapshot?.likesCount ?? undefined,
      commentsCount: latestSnapshot?.commentsCount ?? undefined,
      repostsOrSharesCount: latestSnapshot?.repostsOrSharesCount ?? undefined,
      viewsCount: latestSnapshot?.viewsCount ?? undefined,
      clicksAttributed: latestSnapshot?.clicksAttributed ?? undefined,
      registrationsAttributed:
        latestSnapshot?.registrationsAttributed ?? undefined,
      ticketPurchasesAttributed:
        latestSnapshot?.ticketPurchasesAttributed ?? undefined,
      engagementScore: post.settlement
        ? Number(post.settlement.engagementScore)
        : undefined,
      conversionScore: post.settlement
        ? Number(post.settlement.conversionScore)
        : undefined,
      totalScore: post.settlement
        ? Number(post.settlement.totalScore)
        : undefined,
      grantIssued: Boolean(grant),
      grantStatus: grant
        ? (grant.status as unknown as PromotionBonusGrantStatusGql)
        : undefined,
      grantDiscountPercent: grant ? Number(grant.discountPercent) : undefined,
      grantMaxDiscountAmount: grant
        ? Number(grant.maxDiscountAmount)
        : undefined,
    };
  }

  private getClient(tx?: Prisma.TransactionClient): PrismaClientLike {
    return tx ?? this.prisma;
  }

  private generatePromotionToken(): string {
    return `promo-${randomBytes(6).toString('hex')}`;
  }

  private normalizeBaseUrl(
    value: string | undefined,
    fallback: string,
  ): string {
    const raw = (value || '').trim();
    const base = raw.length > 0 ? raw : fallback;
    return base.replace(/\/$/, '');
  }

  private buildPromotionBonusGrantMessage(params: {
    discountPercent: number;
    maxDiscountAmount: number;
    expiresAt: Date;
  }): string {
    return `Tenés un ${params.discountPercent}% off hasta $${this.formatAmountEsAr(
      params.maxDiscountAmount,
    )} para usar en rifas de otros vendedores. Vence el ${this.formatDateEsAr(
      params.expiresAt,
    )}.`;
  }

  private formatDateEsAr(value: Date): string {
    return new Intl.DateTimeFormat('es-AR', { dateStyle: 'long' }).format(
      value,
    );
  }

  private formatAmountEsAr(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  private getBonusTiers(): BonusTier[] {
    const raw = this.configService.get<string>(
      'SOCIAL_PROMOTION_DEFAULT_BONUS_TIER_JSON',
    );
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as BonusTier[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return [...parsed].sort((a, b) => b.minScore - a.minScore);
        }
      } catch (_error) {
        this.logger.warn('Invalid SOCIAL_PROMOTION_DEFAULT_BONUS_TIER_JSON');
      }
    }

    return [
      { minScore: 60, discountPercent: 15, maxDiscountAmount: 15000 },
      { minScore: 30, discountPercent: 10, maxDiscountAmount: 10000 },
      { minScore: 10, discountPercent: 5, maxDiscountAmount: 5000 },
    ];
  }

  private getAllowedNetworks(): Set<SocialPromotionNetwork> {
    const raw = this.configService.get<string>(
      'SOCIAL_PROMOTION_ALLOWED_NETWORKS',
      'facebook,instagram,x',
    );
    const map: Record<string, SocialPromotionNetwork> = {
      facebook: SocialPromotionNetwork.FACEBOOK,
      instagram: SocialPromotionNetwork.INSTAGRAM,
      x: SocialPromotionNetwork.X,
    };

    return new Set(
      raw
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .map((value) => map[value])
        .filter(Boolean),
    );
  }
}

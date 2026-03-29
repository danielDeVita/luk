import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PromotionBonusGrantStatus,
  PromotionBonusRedemptionStatus,
  SocialPromotionAttributionEventType,
  SocialPromotionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SocialPromotionParserService } from './parsers/social-promotion-parser.service';
import { SocialPromotionPageLoaderService } from './social-promotion-page-loader.service';
import { SocialPromotionsService } from './social-promotions.service';
import { SocialPromotionNetwork } from './entities/social-promotion.entity';
import { ActivityService } from '../activity/activity.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as sentry from '../sentry';

describe('SocialPromotionsService', () => {
  let service: SocialPromotionsService;
  let prisma: any;
  let parser: any;
  let pageLoader: any;
  let activity: any;
  let audit: any;
  let notifications: any;

  const mockPrisma = () => ({
    raffle: {
      findUnique: jest.fn(),
    },
    socialPromotionDraft: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    socialPromotionPost: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    socialPromotionMetricSnapshot: {
      create: jest.fn(),
    },
    socialPromotionAttributionEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    promotionBonusGrant: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    promotionBonusRedemption: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    promotionScoreSettlement: {
      create: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn(async (operations) => Promise.all(operations)),
  });

  const mockConfigService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      const values: Record<string, unknown> = {
        SOCIAL_PROMOTION_TOKEN_TTL_HOURS: 24,
        SOCIAL_PROMOTION_MIN_MP_CHARGE: 1,
        FRONTEND_URL: 'http://localhost:3000',
        BACKEND_URL: 'http://localhost:3001',
        SOCIAL_PROMOTION_DEFAULT_BONUS_TIER_JSON: '',
      };
      return values[key] ?? fallback;
    }),
  };

  const mockParser = {
    detectNetworkFromUrl: jest.fn(),
    canonicalizePermalink: jest.fn(),
    parsePublicContent: jest.fn(),
  };

  const mockPageLoader = {
    loadPublicPage: jest.fn(),
  };

  const mockActivityService = {
    logSocialPromotionDraftCreated: jest.fn().mockResolvedValue(undefined),
    logSocialPromotionPostSubmitted: jest.fn().mockResolvedValue(undefined),
    logSocialPromotionPostDisqualified: jest.fn().mockResolvedValue(undefined),
    logSocialPromotionSettled: jest.fn().mockResolvedValue(undefined),
    logSocialPromotionGrantIssued: jest.fn().mockResolvedValue(undefined),
    logSocialPromotionBonusUsed: jest.fn().mockResolvedValue(undefined),
    logSocialPromotionBonusReversed: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuditService = {
    logSocialPromotionRetried: jest.fn().mockResolvedValue(undefined),
    logSocialPromotionDisqualified: jest.fn().mockResolvedValue(undefined),
  };

  const mockNotificationsService = {
    create: jest.fn().mockResolvedValue(undefined),
    sendPromotionBonusGrantIssuedEmail: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialPromotionsService,
        { provide: PrismaService, useValue: mockPrisma() },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SocialPromotionParserService, useValue: mockParser },
        { provide: SocialPromotionPageLoaderService, useValue: mockPageLoader },
        { provide: ActivityService, useValue: mockActivityService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get(SocialPromotionsService);
    prisma = module.get(PrismaService);
    parser = module.get(SocialPromotionParserService);
    pageLoader = module.get(SocialPromotionPageLoaderService);
    activity = module.get(ActivityService);
    audit = module.get(AuditService);
    notifications = module.get(NotificationsService);
  });

  describe('startSocialPromotionDraft', () => {
    it('creates a draft for an active seller raffle', async () => {
      prisma.raffle.findUnique.mockResolvedValue({
        id: 'raffle-1',
        sellerId: 'seller-1',
        estado: 'ACTIVA',
        titulo: 'iPhone',
      });
      prisma.socialPromotionDraft.create.mockResolvedValue({
        id: 'draft-1',
        raffleId: 'raffle-1',
        sellerId: 'seller-1',
        network: SocialPromotionNetwork.FACEBOOK,
        trackingUrl: 'http://localhost:3001/social-promotions/track/token',
        promotionToken: 'promo-123',
        suggestedCopy: 'copy',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.startSocialPromotionDraft(
        'seller-1',
        'raffle-1',
        SocialPromotionNetwork.FACEBOOK,
      );

      expect(result.id).toBe('draft-1');
      expect(prisma.socialPromotionDraft.create).toHaveBeenCalled();
      expect(activity.logSocialPromotionDraftCreated).toHaveBeenCalledWith(
        'seller-1',
        'draft-1',
        expect.objectContaining({
          raffleId: 'raffle-1',
          network: SocialPromotionNetwork.FACEBOOK,
        }),
      );
    });

    it('rejects when raffle does not belong to seller', async () => {
      prisma.raffle.findUnique.mockResolvedValue({
        id: 'raffle-1',
        sellerId: 'seller-2',
        estado: 'ACTIVA',
        titulo: 'iPhone',
      });

      await expect(
        service.startSocialPromotionDraft(
          'seller-1',
          'raffle-1',
          SocialPromotionNetwork.X,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('submitSocialPromotionPost', () => {
    it('creates a pending post when permalink matches draft network', async () => {
      prisma.socialPromotionDraft.findUnique.mockResolvedValue({
        id: 'draft-1',
        sellerId: 'seller-1',
        raffleId: 'raffle-1',
        network: SocialPromotionNetwork.X,
        expiresAt: new Date(Date.now() + 60_000),
        raffle: { id: 'raffle-1', sellerId: 'seller-1', estado: 'ACTIVA' },
        post: null,
      });
      parser.detectNetworkFromUrl.mockReturnValue(SocialPromotionNetwork.X);
      parser.canonicalizePermalink.mockReturnValue(
        'https://x.com/test/status/1/',
      );
      prisma.socialPromotionPost.create.mockResolvedValue({
        id: 'post-1',
        draftId: 'draft-1',
        raffleId: 'raffle-1',
        sellerId: 'seller-1',
        network: SocialPromotionNetwork.X,
        submittedPermalink: 'https://x.com/test/status/1',
        canonicalPermalink: 'https://x.com/test/status/1/',
        canonicalPostId: null,
        status: SocialPromotionStatus.PENDING_VALIDATION,
        publishedAt: null,
        submittedAt: new Date(),
        validatedAt: null,
        lastCheckedAt: null,
        nextCheckAt: new Date(),
        disqualifiedAt: null,
        disqualificationReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        snapshots: [],
        settlement: null,
      });

      const result = await service.submitSocialPromotionPost(
        'seller-1',
        'draft-1',
        'https://x.com/test/status/1',
      );

      expect(result.status).toBe(SocialPromotionStatus.PENDING_VALIDATION);
      expect(activity.logSocialPromotionPostSubmitted).toHaveBeenCalledWith(
        'seller-1',
        'post-1',
        expect.objectContaining({
          raffleId: 'raffle-1',
          draftId: 'draft-1',
          network: SocialPromotionNetwork.X,
        }),
      );
    });

    it('throws when the URL network does not match the draft network', async () => {
      prisma.socialPromotionDraft.findUnique.mockResolvedValue({
        id: 'draft-1',
        sellerId: 'seller-1',
        raffleId: 'raffle-1',
        network: SocialPromotionNetwork.FACEBOOK,
        expiresAt: new Date(Date.now() + 60_000),
        raffle: { id: 'raffle-1', sellerId: 'seller-1', estado: 'ACTIVA' },
        post: null,
      });
      parser.detectNetworkFromUrl.mockReturnValue(SocialPromotionNetwork.X);

      await expect(
        service.submitSocialPromotionPost(
          'seller-1',
          'draft-1',
          'https://x.com/test/status/1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('previewPromotionBonus', () => {
    it('calculates preview for an available grant', async () => {
      prisma.raffle.findUnique.mockResolvedValue({
        id: 'raffle-1',
        sellerId: 'seller-2',
        precioPorTicket: 1000,
        estado: 'ACTIVA',
      });
      prisma.promotionBonusGrant.findFirst.mockResolvedValue({
        id: 'grant-1',
        sellerId: 'buyer-1',
        discountPercent: 10,
        maxDiscountAmount: 1000,
        expiresAt: new Date(Date.now() + 60_000),
        status: PromotionBonusGrantStatus.AVAILABLE,
      });

      const preview = await service.previewPromotionBonus(
        'buyer-1',
        'raffle-1',
        2,
        'grant-1',
      );

      expect(preview.grossSubtotal).toBe(2000);
      expect(preview.discountApplied).toBe(200);
      expect(preview.mpChargeAmount).toBe(1800);
    });
  });

  describe('reserveBonusForCheckout', () => {
    it('creates a redemption and reserves the grant', async () => {
      prisma.promotionBonusGrant.findFirst.mockResolvedValue({
        id: 'grant-1',
        sellerId: 'buyer-1',
        discountPercent: 10,
        maxDiscountAmount: 500,
        expiresAt: new Date(Date.now() + 60_000),
        status: PromotionBonusGrantStatus.AVAILABLE,
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceSettlementId: 'settlement-1',
        usedAt: null,
      });
      prisma.promotionBonusRedemption.create.mockResolvedValue({
        id: 'redemption-1',
      });

      const result = await service.reserveBonusForCheckout({
        buyerId: 'buyer-1',
        raffleId: 'raffle-1',
        raffleSellerId: 'seller-2',
        reservationId: 'reservation-1',
        grossSubtotal: 1000,
        bonusGrantId: 'grant-1',
      });

      expect(prisma.promotionBonusGrant.update).toHaveBeenCalledWith({
        where: { id: 'grant-1' },
        data: { status: PromotionBonusGrantStatus.RESERVED },
      });
      expect(prisma.promotionBonusRedemption.create).toHaveBeenCalled();
      expect(result?.preview.discountApplied).toBe(100);
    });
  });

  describe('reinstateRedemptionByPaymentId', () => {
    it('reinstates the grant and records a reversal transaction for a full refund', async () => {
      prisma.promotionBonusRedemption.findMany.mockResolvedValue([
        {
          id: 'redemption-1',
          promotionBonusGrantId: 'grant-1',
          buyerId: 'buyer-1',
          raffleId: 'raffle-1',
          grossSubtotal: 1200,
          discountApplied: 200,
          mpChargeAmount: 1000,
          status: PromotionBonusRedemptionStatus.USED,
        },
      ]);

      await service.reinstateRedemptionByPaymentId('mp-123');

      expect(prisma.promotionBonusRedemption.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'redemption-1' },
          data: expect.objectContaining({
            status: PromotionBonusRedemptionStatus.REVERSED,
          }),
        }),
      );
      expect(prisma.promotionBonusGrant.update).toHaveBeenCalledWith({
        where: { id: 'grant-1' },
        data: {
          status: PromotionBonusGrantStatus.AVAILABLE,
          usedAt: null,
        },
      });
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'REVERSION_BONIFICACION_PROMOCIONAL',
            userId: 'buyer-1',
            raffleId: 'raffle-1',
            monto: 200,
            mpPaymentId: 'mp-123',
          }),
        }),
      );
    });

    it('keeps the grant used for a partial refund', async () => {
      prisma.promotionBonusRedemption.findMany.mockResolvedValue([
        {
          id: 'redemption-1',
          promotionBonusGrantId: 'grant-1',
          buyerId: 'buyer-1',
          raffleId: 'raffle-1',
          grossSubtotal: 1200,
          discountApplied: 200,
          mpChargeAmount: 1000,
          status: PromotionBonusRedemptionStatus.USED,
        },
      ]);

      await service.reinstateRedemptionByPaymentId('mp-123', 250);

      expect(prisma.promotionBonusRedemption.update).not.toHaveBeenCalled();
      expect(prisma.promotionBonusGrant.update).not.toHaveBeenCalled();
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('validateSocialPromotionPost', () => {
    it('creates an ACTIVE snapshot when the post is public and token is present', async () => {
      prisma.socialPromotionPost.findUnique.mockResolvedValue({
        id: 'post-1',
        raffleId: 'raffle-1',
        sellerId: 'seller-1',
        network: SocialPromotionNetwork.X,
        submittedPermalink: 'https://x.com/test/status/1',
        validatedAt: null,
        draft: {
          promotionToken: 'token-123',
          trackingUrl: 'https://luk.app/promo/token-123',
        },
        raffle: { id: 'raffle-1', estado: 'ACTIVA' },
      });
      pageLoader.loadPublicPage.mockResolvedValue({
        html: '<html></html>',
        finalUrl: 'https://x.com/test/status/1',
        loader: 'fetch',
      });
      parser.parsePublicContent.mockReturnValue({
        canonicalPermalink: 'https://x.com/test/status/1/',
        canonicalPostId: '1',
        isAccessible: true,
        tokenPresent: true,
        metrics: {
          likesCount: 100,
          commentsCount: 10,
          repostsOrSharesCount: 5,
          viewsCount: 1200,
        },
      });
      prisma.socialPromotionAttributionEvent.findMany.mockResolvedValue([
        {
          eventType: SocialPromotionAttributionEventType.CLICK,
          ticketCount: null,
        },
        {
          eventType: SocialPromotionAttributionEventType.REGISTRATION,
          ticketCount: null,
        },
        {
          eventType: SocialPromotionAttributionEventType.PURCHASE,
          ticketCount: 3,
        },
      ]);

      await service.validateSocialPromotionPost('post-1');

      expect(prisma.socialPromotionMetricSnapshot.create).toHaveBeenCalled();
      expect(prisma.socialPromotionPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'post-1' },
          data: expect.objectContaining({
            status: SocialPromotionStatus.ACTIVE,
          }),
        }),
      );
    });

    it('reconnects Prisma and retries when the validation write hits a transient connection error', async () => {
      prisma.socialPromotionPost.findUnique.mockResolvedValue({
        id: 'post-1',
        raffleId: 'raffle-1',
        sellerId: 'seller-1',
        network: SocialPromotionNetwork.FACEBOOK,
        submittedPermalink: 'https://www.facebook.com/share/p/abc123',
        validatedAt: null,
        draft: {
          promotionToken: 'token-123',
          trackingUrl: 'https://luk.app/promo/token-123',
        },
        raffle: { id: 'raffle-1', estado: 'ACTIVA' },
      });
      pageLoader.loadPublicPage.mockResolvedValue({
        html: '<html><head><meta property="og:url" content="https://www.facebook.com/share/p/abc123/" /></head></html>',
        finalUrl: 'https://www.facebook.com/share/p/abc123/',
        loader: 'playwright',
      });
      parser.parsePublicContent.mockReturnValue({
        canonicalPermalink: 'https://www.facebook.com/share/p/abc123/',
        canonicalPostId: 'abc123',
        isAccessible: true,
        tokenPresent: true,
        metrics: {
          likesCount: 12,
          commentsCount: 3,
          repostsOrSharesCount: 1,
          viewsCount: 250,
        },
      });
      prisma.socialPromotionAttributionEvent.findMany.mockResolvedValue([]);
      prisma.$transaction
        .mockRejectedValueOnce({
          code: 'P1017',
          message: 'Server has closed the connection.',
        })
        .mockResolvedValueOnce([{}, {}]);

      await service.validateSocialPromotionPost('post-1');

      expect(prisma.$disconnect).toHaveBeenCalledTimes(1);
      expect(prisma.$connect).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(prisma.socialPromotionPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'post-1' },
          data: expect.objectContaining({
            status: SocialPromotionStatus.ACTIVE,
          }),
        }),
      );
    });

    it('retries with browser when the first load finds the post but no visible metrics', async () => {
      prisma.socialPromotionPost.findUnique.mockResolvedValue({
        id: 'post-1',
        raffleId: 'raffle-1',
        sellerId: 'seller-1',
        network: SocialPromotionNetwork.X,
        submittedPermalink: 'https://x.com/seller/status/abc123',
        validatedAt: null,
        draft: {
          promotionToken: 'token-123',
          trackingUrl: 'https://luk.app/promo/token-123',
        },
        raffle: { id: 'raffle-1', estado: 'ACTIVA' },
      });
      pageLoader.loadPublicPage
        .mockResolvedValueOnce({
          html: '<html></html>',
          finalUrl: 'https://x.com/seller/status/abc123',
          loader: 'fetch',
        })
        .mockResolvedValueOnce({
          html: '<html><body>27 likes 6 replies 3 reposts 420 views token-123</body></html>',
          finalUrl: 'https://x.com/seller/status/abc123',
          loader: 'playwright',
        });
      parser.parsePublicContent
        .mockReturnValueOnce({
          canonicalPermalink: 'https://x.com/seller/status/abc123/',
          canonicalPostId: 'abc123',
          isAccessible: true,
          tokenPresent: true,
          metrics: {},
        })
        .mockReturnValueOnce({
          canonicalPermalink: 'https://x.com/seller/status/abc123/',
          canonicalPostId: 'abc123',
          isAccessible: true,
          tokenPresent: true,
          metrics: {
            likesCount: 27,
            commentsCount: 6,
            repostsOrSharesCount: 3,
            viewsCount: 420,
          },
        });
      prisma.socialPromotionAttributionEvent.findMany.mockResolvedValue([]);

      await service.validateSocialPromotionPost('post-1');

      expect(pageLoader.loadPublicPage).toHaveBeenNthCalledWith(
        1,
        'https://x.com/seller/status/abc123',
        { preferBrowser: undefined },
      );
      expect(pageLoader.loadPublicPage).toHaveBeenNthCalledWith(
        2,
        'https://x.com/seller/status/abc123',
        { preferBrowser: true },
      );
      expect(prisma.socialPromotionMetricSnapshot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            likesCount: 27,
            commentsCount: 6,
            repostsOrSharesCount: 3,
            viewsCount: 420,
            rawEvidenceMeta: expect.objectContaining({
              loader: 'playwright',
              metricsDetected: true,
            }),
          }),
        }),
      );
    });
  });

  describe('settleSocialPromotionPost', () => {
    it('creates a grant and notifies the seller when a tier matches', async () => {
      const expiresAt = new Date('2026-04-15T12:00:00.000Z');

      prisma.socialPromotionPost.findUnique.mockResolvedValue({
        id: 'post-1',
        raffleId: 'raffle-1',
        sellerId: 'seller-1',
        network: SocialPromotionNetwork.X,
        snapshots: [
          {
            checkedAt: new Date(),
            isAccessible: true,
            tokenPresent: true,
            likesCount: 250,
            commentsCount: 30,
            repostsOrSharesCount: 10,
            viewsCount: 3000,
            clicksAttributed: 12,
            registrationsAttributed: 2,
            ticketPurchasesAttributed: 1,
          },
        ],
        settlement: null,
        raffle: { id: 'raffle-1', titulo: 'iPhone 15 Pro' },
        seller: {
          id: 'seller-1',
          email: 'seller@example.com',
          nombre: 'Juan',
          apellido: 'Pérez',
        },
      });
      prisma.promotionScoreSettlement.create.mockResolvedValue({
        id: 'settlement-1',
      });
      prisma.promotionBonusGrant.create.mockResolvedValue({
        id: 'grant-1',
        discountPercent: 10,
        maxDiscountAmount: 10000,
        expiresAt,
      });

      await service.settleSocialPromotionPost('post-1');

      expect(prisma.promotionBonusGrant.create).toHaveBeenCalled();
      expect(activity.logSocialPromotionGrantIssued).toHaveBeenCalledWith(
        'seller-1',
        'grant-1',
        expect.objectContaining({
          postId: 'post-1',
          raffleId: 'raffle-1',
          settlementId: 'settlement-1',
        }),
      );
      expect(notifications.create).toHaveBeenCalledWith(
        'seller-1',
        'SOCIAL_PROMOTION_GRANT_ISSUED',
        'Ganaste una bonificación promocional',
        expect.stringContaining('10% off hasta $10.000'),
        '/dashboard/tickets',
      );
      expect(
        notifications.sendPromotionBonusGrantIssuedEmail,
      ).toHaveBeenCalledWith('seller@example.com', {
        userName: 'Juan',
        raffleName: 'iPhone 15 Pro',
        discountPercent: 10,
        maxDiscountAmount: 10000,
        expiresAt,
      });
    });

    it('does not notify when no bonus tier matches', async () => {
      Object.defineProperty(service, 'defaultBonusTiers', {
        value: [
          { minScore: 9999, discountPercent: 5, maxDiscountAmount: 5000 },
        ],
        configurable: true,
      });

      prisma.socialPromotionPost.findUnique.mockResolvedValue({
        id: 'post-1',
        raffleId: 'raffle-1',
        sellerId: 'seller-1',
        network: SocialPromotionNetwork.X,
        snapshots: [
          {
            checkedAt: new Date(),
            isAccessible: true,
            tokenPresent: true,
            likesCount: 1,
            commentsCount: 0,
            repostsOrSharesCount: 0,
            viewsCount: 0,
            clicksAttributed: 0,
            registrationsAttributed: 0,
            ticketPurchasesAttributed: 0,
          },
        ],
        settlement: null,
        raffle: { id: 'raffle-1', titulo: 'iPhone 15 Pro' },
        seller: {
          id: 'seller-1',
          email: 'seller@example.com',
          nombre: 'Juan',
          apellido: 'Pérez',
        },
      });
      prisma.promotionScoreSettlement.create.mockResolvedValue({
        id: 'settlement-1',
      });

      await service.settleSocialPromotionPost('post-1');

      expect(prisma.promotionBonusGrant.create).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
      expect(
        notifications.sendPromotionBonusGrantIssuedEmail,
      ).not.toHaveBeenCalled();
    });

    it('keeps settlement successful when grant notifications fail', async () => {
      const captureExceptionSpy = jest
        .spyOn(sentry, 'captureException')
        .mockImplementation(() => undefined);

      prisma.socialPromotionPost.findUnique.mockResolvedValue({
        id: 'post-1',
        raffleId: 'raffle-1',
        sellerId: 'seller-1',
        network: SocialPromotionNetwork.X,
        snapshots: [
          {
            checkedAt: new Date(),
            isAccessible: true,
            tokenPresent: true,
            likesCount: 250,
            commentsCount: 30,
            repostsOrSharesCount: 10,
            viewsCount: 3000,
            clicksAttributed: 12,
            registrationsAttributed: 2,
            ticketPurchasesAttributed: 1,
          },
        ],
        settlement: null,
        raffle: { id: 'raffle-1', titulo: 'iPhone 15 Pro' },
        seller: {
          id: 'seller-1',
          email: 'seller@example.com',
          nombre: 'Juan',
          apellido: 'Pérez',
        },
      });
      prisma.promotionScoreSettlement.create.mockResolvedValue({
        id: 'settlement-1',
      });
      prisma.promotionBonusGrant.create.mockResolvedValue({
        id: 'grant-1',
        discountPercent: 10,
        maxDiscountAmount: 10000,
        expiresAt: new Date('2026-04-15T12:00:00.000Z'),
      });
      notifications.create.mockRejectedValueOnce(
        new Error('notification write failed'),
      );
      notifications.sendPromotionBonusGrantIssuedEmail.mockResolvedValueOnce(
        false,
      );

      await expect(service.settleSocialPromotionPost('post-1')).resolves.toBe(
        undefined,
      );

      expect(prisma.promotionScoreSettlement.create).toHaveBeenCalled();
      expect(prisma.promotionBonusGrant.create).toHaveBeenCalled();
      expect(captureExceptionSpy).toHaveBeenCalledTimes(2);

      captureExceptionSpy.mockRestore();
    });
  });

  describe('error reporting', () => {
    it('captures unexpected validation loop errors to Sentry', async () => {
      const captureExceptionSpy = jest
        .spyOn(sentry, 'captureException')
        .mockImplementation(() => undefined);

      prisma.socialPromotionPost.findMany.mockResolvedValue([
        { id: 'post-1', raffleId: 'raffle-1', sellerId: 'seller-1' },
      ]);

      jest
        .spyOn(service, 'validateSocialPromotionPost')
        .mockRejectedValue(new Error('validation exploded'));

      await expect(service.processDueSocialPromotionPosts()).resolves.toBe(0);

      expect(captureExceptionSpy).toHaveBeenCalled();
      captureExceptionSpy.mockRestore();
    });
  });

  describe('trackPromotionClickByToken', () => {
    it('redirects to the raffle page and records the click', async () => {
      prisma.socialPromotionDraft.findUnique.mockResolvedValue({
        id: 'draft-1',
        raffleId: 'raffle-1',
        post: { id: 'post-1' },
      });

      const redirectUrl = await service.trackPromotionClickByToken('token-123');

      expect(redirectUrl).toBe(
        'http://localhost:3000/raffle/raffle-1?promo=token-123',
      );
      expect(prisma.socialPromotionAttributionEvent.create).toHaveBeenCalled();
    });
  });

  describe('recordRegistrationAttribution', () => {
    it('does nothing when promotion token is missing', async () => {
      await service.recordRegistrationAttribution('user-1');
      expect(prisma.socialPromotionPost.findFirst).not.toHaveBeenCalled();
    });

    it('creates a registration event when post exists', async () => {
      prisma.socialPromotionPost.findFirst.mockResolvedValue({ id: 'post-1' });
      prisma.socialPromotionAttributionEvent.findFirst.mockResolvedValue(null);

      await service.recordRegistrationAttribution('user-1', 'token-123');

      expect(prisma.socialPromotionAttributionEvent.create).toHaveBeenCalled();
    });
  });

  describe('admin moderation', () => {
    it('builds admin analytics rows from the latest snapshot, settlement, and grant', async () => {
      prisma.socialPromotionPost.findMany.mockResolvedValue([
        {
          id: 'post-1',
          raffleId: 'raffle-1',
          sellerId: 'seller-1',
          network: SocialPromotionNetwork.INSTAGRAM,
          status: SocialPromotionStatus.SETTLED,
          submittedPermalink: 'https://instagram.com/p/post-1',
          canonicalPermalink: 'https://instagram.com/p/post-1/',
          submittedAt: new Date('2026-03-10T10:00:00.000Z'),
          validatedAt: new Date('2026-03-10T11:00:00.000Z'),
          raffle: {
            id: 'raffle-1',
            titulo: 'MacBook Air',
          },
          seller: {
            id: 'seller-1',
            email: 'seller-1@example.com',
          },
          snapshots: [
            {
              likesCount: 120,
              commentsCount: 15,
              repostsOrSharesCount: 7,
              viewsCount: 2500,
              clicksAttributed: 42,
              registrationsAttributed: 5,
              ticketPurchasesAttributed: 9,
            },
          ],
          settlement: {
            id: 'settlement-1',
            settledAt: new Date('2026-03-11T10:00:00.000Z'),
            engagementScore: 18.5,
            conversionScore: 25.5,
            totalScore: 54,
          },
        },
        {
          id: 'post-2',
          raffleId: 'raffle-2',
          sellerId: 'seller-2',
          network: SocialPromotionNetwork.X,
          status: SocialPromotionStatus.ACTIVE,
          submittedPermalink: 'https://x.com/test/status/2',
          canonicalPermalink: null,
          submittedAt: new Date('2026-03-09T10:00:00.000Z'),
          validatedAt: null,
          raffle: {
            id: 'raffle-2',
            titulo: 'PlayStation 5',
          },
          seller: {
            id: 'seller-2',
            email: 'seller-2@example.com',
          },
          snapshots: [],
          settlement: null,
        },
      ]);
      prisma.promotionBonusGrant.findMany.mockResolvedValue([
        {
          id: 'grant-1',
          sellerId: 'seller-1',
          sourceSettlementId: 'settlement-1',
          discountPercent: 15,
          maxDiscountAmount: 15000,
          expiresAt: new Date('2026-04-10T10:00:00.000Z'),
          status: PromotionBonusGrantStatus.AVAILABLE,
          createdAt: new Date('2026-03-11T10:00:00.000Z'),
          usedAt: null,
        },
      ]);

      const result = await service.getSocialPromotionAnalytics();

      expect(prisma.socialPromotionPost.findMany).toHaveBeenCalledWith({
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
      expect(prisma.promotionBonusGrant.findMany).toHaveBeenCalledWith({
        where: {
          sourceSettlementId: {
            in: ['settlement-1'],
          },
        },
      });
      expect(result).toEqual([
        expect.objectContaining({
          postId: 'post-1',
          raffleTitle: 'MacBook Air',
          sellerEmail: 'seller-1@example.com',
          clicksAttributed: 42,
          registrationsAttributed: 5,
          ticketPurchasesAttributed: 9,
          conversionScore: 25.5,
          totalScore: 54,
          grantIssued: true,
          grantStatus: PromotionBonusGrantStatus.AVAILABLE,
          grantDiscountPercent: 15,
          grantMaxDiscountAmount: 15000,
        }),
        expect.objectContaining({
          postId: 'post-2',
          raffleTitle: 'PlayStation 5',
          sellerEmail: 'seller-2@example.com',
          grantIssued: false,
          settledAt: undefined,
          conversionScore: undefined,
          totalScore: undefined,
          clicksAttributed: undefined,
        }),
      ]);
    });

    it('logs audit metadata when retrying a technical-review post', async () => {
      prisma.socialPromotionPost.findUnique.mockResolvedValue({
        id: 'post-1',
        raffleId: 'raffle-1',
        sellerId: 'seller-1',
        status: SocialPromotionStatus.TECHNICAL_REVIEW,
        network: SocialPromotionNetwork.X,
      });
      prisma.socialPromotionPost.update.mockResolvedValue({
        id: 'post-1',
        draftId: 'draft-1',
        raffleId: 'raffle-1',
        sellerId: 'seller-1',
        network: SocialPromotionNetwork.X,
        submittedPermalink: 'https://x.com/test/status/1',
        canonicalPermalink: null,
        canonicalPostId: null,
        status: SocialPromotionStatus.PENDING_VALIDATION,
        publishedAt: null,
        submittedAt: new Date(),
        validatedAt: null,
        lastCheckedAt: null,
        nextCheckAt: new Date(),
        disqualifiedAt: null,
        disqualificationReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        snapshots: [],
        settlement: null,
      });

      await service.retryTechnicalReview('post-1', 'admin-1');

      expect(audit.logSocialPromotionRetried).toHaveBeenCalledWith(
        'admin-1',
        'post-1',
        expect.objectContaining({
          raffleId: 'raffle-1',
          previousStatus: SocialPromotionStatus.TECHNICAL_REVIEW,
        }),
      );
    });
  });
});

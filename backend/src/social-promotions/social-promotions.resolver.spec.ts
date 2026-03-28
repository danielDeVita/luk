import { Test, TestingModule } from '@nestjs/testing';
import { SocialPromotionsResolver } from './social-promotions.resolver';
import { SocialPromotionsService } from './social-promotions.service';
import { SocialPromotionNetwork } from './entities/social-promotion.entity';

describe('SocialPromotionsResolver', () => {
  let resolver: SocialPromotionsResolver;
  let service: jest.Mocked<SocialPromotionsService>;

  const mockService = {
    startSocialPromotionDraft: jest.fn(),
    submitSocialPromotionPost: jest.fn(),
    mySocialPromotionPosts: jest.fn(),
    myPromotionBonusGrants: jest.fn(),
    previewPromotionBonus: jest.fn(),
    getTechnicalReviewQueue: jest.fn(),
    retryTechnicalReview: jest.fn(),
    adminDisqualifyPost: jest.fn(),
  } as unknown as jest.Mocked<SocialPromotionsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialPromotionsResolver,
        { provide: SocialPromotionsService, useValue: mockService },
      ],
    }).compile();

    resolver = module.get(SocialPromotionsResolver);
    service = module.get(SocialPromotionsService);
    jest.clearAllMocks();
  });

  it('starts a social promotion draft for the current user', async () => {
    service.startSocialPromotionDraft.mockResolvedValue({
      id: 'draft-1',
    } as any);

    const result = await resolver.startSocialPromotionDraft(
      { id: 'user-1' } as any,
      'raffle-1',
      SocialPromotionNetwork.X,
    );

    expect(result.id).toBe('draft-1');
    expect(service.startSocialPromotionDraft).toHaveBeenCalledWith(
      'user-1',
      'raffle-1',
      SocialPromotionNetwork.X,
    );
  });

  it('submits a social promotion post for the current user', async () => {
    service.submitSocialPromotionPost.mockResolvedValue({
      id: 'post-1',
    } as any);

    const result = await resolver.submitSocialPromotionPost(
      { id: 'user-1' } as any,
      'draft-1',
      'https://x.com/test/status/1',
    );

    expect(result.id).toBe('post-1');
    expect(service.submitSocialPromotionPost).toHaveBeenCalledWith(
      'user-1',
      'draft-1',
      'https://x.com/test/status/1',
    );
  });

  it('passes the admin id when retrying a social promotion post', async () => {
    service.retryTechnicalReview.mockResolvedValue({ id: 'post-1' } as any);

    const result = await resolver.adminRetrySocialPromotionPost(
      { id: 'admin-1' } as any,
      'post-1',
    );

    expect(result.id).toBe('post-1');
    expect(service.retryTechnicalReview).toHaveBeenCalledWith(
      'post-1',
      'admin-1',
    );
  });

  it('passes the admin id when force-disqualifying a social promotion post', async () => {
    service.adminDisqualifyPost.mockResolvedValue({ id: 'post-1' } as any);

    const result = await resolver.adminDisqualifySocialPromotionPost(
      { id: 'admin-1' } as any,
      'post-1',
      'Token faltante',
    );

    expect(result.id).toBe('post-1');
    expect(service.adminDisqualifyPost).toHaveBeenCalledWith(
      'post-1',
      'Token faltante',
      'admin-1',
    );
  });
});

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SocialPromotionsService } from './social-promotions.service';

function isDisabledFlag(value: boolean | string | undefined): boolean {
  return (
    value === false ||
    (typeof value === 'string' && value.trim().toLowerCase() === 'false')
  );
}

@Injectable()
export class SocialPromotionWorkerService {
  private readonly logger = new Logger(SocialPromotionWorkerService.name);
  private readonly enabled: boolean;

  constructor(
    private readonly socialPromotionsService: SocialPromotionsService,
    private readonly configService: ConfigService,
  ) {
    const featureEnabled = this.configService.get<boolean | string>(
      'SOCIAL_PROMOTION_ENABLED',
    );
    this.enabled = !isDisabledFlag(featureEnabled);
  }

  @Cron(process.env.SOCIAL_PROMOTION_CHECK_CRON || '0 */6 * * *')
  async processDuePosts() {
    if (!this.enabled) return;

    const processed =
      await this.socialPromotionsService.processDueSocialPromotionPosts();
    if (processed > 0) {
      this.logger.log(
        `Processed ${processed} social promotion posts due for validation`,
      );
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async settleClosedPosts() {
    if (!this.enabled) return;

    const settled =
      await this.socialPromotionsService.settleClosedSocialPromotionPosts();
    if (settled > 0) {
      this.logger.log(`Settled ${settled} closed social promotion posts`);
    }
  }
}

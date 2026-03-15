import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { SocialPromotionsService } from './social-promotions.service';

/**
 * REST entrypoints used by the public promotion tracking link flow.
 */
@Controller('social-promotions')
export class SocialPromotionsController {
  constructor(
    private readonly socialPromotionsService: SocialPromotionsService,
  ) {}

  /**
   * Tracks a promotion click and redirects the visitor to the raffle page.
   */
  @Get('track/:token')
  @Public()
  async trackPromotion(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const redirectUrl =
      await this.socialPromotionsService.trackPromotionClickByToken(token);
    res.redirect(302, redirectUrl);
  }
}

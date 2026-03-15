import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { SocialPromotionsService } from './social-promotions.service';

@Controller('social-promotions')
export class SocialPromotionsController {
  constructor(
    private readonly socialPromotionsService: SocialPromotionsService,
  ) {}

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

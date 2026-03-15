import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SocialPromotionsController } from './social-promotions.controller';
import { SocialPromotionsResolver } from './social-promotions.resolver';
import { SocialPromotionsService } from './social-promotions.service';
import { SocialPromotionParserService } from './parsers/social-promotion-parser.service';
import { SocialPromotionPageLoaderService } from './social-promotion-page-loader.service';

@Module({
  imports: [PrismaModule],
  controllers: [SocialPromotionsController],
  providers: [
    SocialPromotionsResolver,
    SocialPromotionsService,
    SocialPromotionParserService,
    SocialPromotionPageLoaderService,
  ],
  exports: [SocialPromotionsService],
})
export class SocialPromotionsModule {}

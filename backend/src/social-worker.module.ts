import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { WinstonModule } from 'nest-winston';
import { PrismaModule } from './prisma/prisma.module';
import { winstonConfig } from './common/logger';
import { validate } from './common/config/env.validation';
import { SocialPromotionsModule } from './social-promotions/social-promotions.module';
import { SocialPromotionWorkerService } from './social-promotions/social-promotion-worker.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
      validate,
    }),
    WinstonModule.forRoot(winstonConfig),
    ScheduleModule.forRoot(),
    PrismaModule,
    SocialPromotionsModule,
  ],
  providers: [SocialPromotionWorkerService],
})
export class SocialWorkerModule {}

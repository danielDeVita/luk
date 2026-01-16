import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AppModule } from '../../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  jwtService: JwtService;
  configService: ConfigService;
}

/**
 * Create and initialize a NestJS test application.
 * Uses the real AppModule with real database connections.
 */
export async function createTestApp(): Promise<TestContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  // Match production configuration
  app.use(cookieParser());
  app.enableCors({
    origin: true,
    credentials: true,
  });

  await app.init();

  const prisma = moduleFixture.get<PrismaService>(PrismaService);
  const jwtService = moduleFixture.get<JwtService>(JwtService);
  const configService = moduleFixture.get<ConfigService>(ConfigService);

  return { app, prisma, jwtService, configService };
}

/**
 * Clean up test data and close the application.
 * Call this in afterAll() hooks.
 */
export async function cleanupTestApp(ctx: TestContext): Promise<void> {
  // Clean up test data in reverse dependency order
  await ctx.prisma.refreshToken.deleteMany({});
  await ctx.prisma.activityLog.deleteMany({});
  await ctx.prisma.message.deleteMany({});
  await ctx.prisma.conversation.deleteMany({});
  await ctx.prisma.payout.deleteMany({});
  await ctx.prisma.auditLog.deleteMany({});
  await ctx.prisma.favorite.deleteMany({});
  await ctx.prisma.shippingAddress.deleteMany({});
  await ctx.prisma.notification.deleteMany({});
  await ctx.prisma.report.deleteMany({});
  await ctx.prisma.mpEvent.deleteMany({});
  await ctx.prisma.drawResult.deleteMany({});
  await ctx.prisma.review.deleteMany({});
  await ctx.prisma.dispute.deleteMany({});
  await ctx.prisma.priceReduction.deleteMany({});
  await ctx.prisma.transaction.deleteMany({});
  await ctx.prisma.ticket.deleteMany({});
  await ctx.prisma.product.deleteMany({});
  await ctx.prisma.raffle.deleteMany({});
  await ctx.prisma.userReputation.deleteMany({});
  await ctx.prisma.user.deleteMany({});

  await ctx.app.close();
}

/**
 * Generate a JWT token for a test user.
 */
export function generateTestToken(
  ctx: TestContext,
  user: { id: string; email: string; role: string },
): string {
  return ctx.jwtService.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    {
      secret: ctx.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: '1h',
    },
  );
}

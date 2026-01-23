import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    configService: ConfigService,
  ) {
    // Extract JWT from httpOnly cookie first, then fall back to Authorization header
    const jwtFromRequest = ExtractJwt.fromExtractors([
      // 1. Try to extract from httpOnly cookie (new secure method)
      (req: Request): string | null => {
        const cookies = req?.cookies as Record<string, string> | undefined;
        const token = cookies?.auth_token;
        if (token) return token;
        return null;
      },
      // 2. Fall back to Authorization header (for backwards compatibility)
      (req: Request): string | null => {
        const authHeader = req?.headers?.authorization;
        if (typeof authHeader !== 'string') return null;
        return authHeader.replace(/^Bearer\s+/i, '');
      },
    ]);

    super({
      jwtFromRequest,
      ignoreExpiration: false, // Tokens expire after 15 minutes, use refresh token
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    // User must exist
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // User must not be soft deleted
    if (user.isDeleted) {
      throw new UnauthorizedException('Account has been deleted');
    }

    // User must not be banned
    if (user.role === 'BANNED') {
      throw new UnauthorizedException('Account has been banned');
    }

    return user;
  }
}

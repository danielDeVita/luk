import {
  Injectable,
  NestMiddleware,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

const CSRF_TOKEN_COOKIE = 'csrf_token';
const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

/**
 * CSRF Protection Middleware using Double Submit Cookie pattern.
 *
 * How it works:
 * 1. On first request, sets a random CSRF token in a non-httpOnly cookie
 * 2. Frontend reads this cookie and sends it back in the X-CSRF-Token header
 * 3. Middleware validates that header value matches cookie value
 *
 * Why Double Submit Cookie:
 * - Stateless (no server-side token storage)
 * - Works well with SPAs and API-first architecture
 * - Cookie is SameSite=Strict so can't be read by other origins
 *
 * Excluded paths:
 * - Webhooks (external services, have their own verification)
 * - OAuth callbacks (initiated by redirects, have state param)
 * - GET requests (read-only, no side effects)
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CsrfMiddleware.name);
  private readonly isProduction: boolean;

  // Paths exempt from CSRF validation
  private readonly exemptPaths = [
    '/graphql', // GraphQL uses JWT authentication, not cookies
    '/mp/webhook', // Mercado Pago webhooks (use signature verification)
    '/auth/google', // OAuth redirect (stateless flow)
    '/auth/google/callback', // OAuth callback (has state param)
    '/mp/connect/callback', // MP OAuth callback
    '/health', // Health checks
    '/health/ready',
    '/health/live',
  ];

  constructor(private configService: ConfigService) {
    this.isProduction = configService.get('NODE_ENV') === 'production';
  }

  use(req: Request, res: Response, next: NextFunction): void {
    // Skip CSRF for exempt paths
    if (this.isExemptPath(req.path)) {
      return next();
    }

    // Skip CSRF for safe methods (GET, HEAD, OPTIONS)
    if (this.isSafeMethod(req.method)) {
      // Ensure token cookie exists for subsequent requests
      this.ensureTokenCookie(req, res);
      return next();
    }

    // For state-changing requests (POST, PUT, DELETE, PATCH)
    const cookieToken = (req.cookies as Record<string, string> | undefined)?.[
      CSRF_TOKEN_COOKIE
    ];
    const headerToken = req.headers[CSRF_TOKEN_HEADER] as string | undefined;

    // Ensure token cookie exists
    if (!cookieToken) {
      this.setTokenCookie(res);
      this.logger.warn(`CSRF: No token cookie for ${req.method} ${req.path}`);
      throw new ForbiddenException(
        'CSRF token missing. Please refresh the page.',
      );
    }

    // Validate header token matches cookie token
    if (!headerToken || !this.secureCompare(cookieToken, headerToken)) {
      this.logger.warn(
        `CSRF validation failed for ${req.method} ${req.path} - ` +
          `cookie: ${cookieToken ? 'present' : 'missing'}, header: ${headerToken ? 'present' : 'missing'}`,
      );
      throw new ForbiddenException(
        'Invalid CSRF token. Please refresh the page.',
      );
    }

    // Rotate token on successful validation (prevents token fixation)
    this.setTokenCookie(res);
    next();
  }

  private isExemptPath(path: string): boolean {
    return this.exemptPaths.some((exemptPath) => path.startsWith(exemptPath));
  }

  private isSafeMethod(method: string): boolean {
    return ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  }

  private ensureTokenCookie(req: Request, res: Response): void {
    if (!req.cookies?.[CSRF_TOKEN_COOKIE]) {
      this.setTokenCookie(res);
    }
  }

  private setTokenCookie(res: Response): void {
    const token = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
    res.cookie(CSRF_TOKEN_COOKIE, token, {
      httpOnly: false, // Must be readable by JavaScript
      secure: this.isProduction,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });
  }

  /**
   * Constant-time string comparison to prevent timing attacks.
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    try {
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
      return false;
    }
  }
}

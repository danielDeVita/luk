import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { LoginThrottlerService } from './login-throttler.service';

/**
 * Guard to protect login endpoints from brute force attacks.
 * Blocks IPs after too many failed login attempts.
 *
 * Usage:
 * Apply to login mutation in auth.resolver.ts:
 * @UseGuards(LoginThrottlerGuard)
 * @Mutation(() => AuthPayload)
 * async login(@Args('input') input: LoginInput) { ... }
 */
@Injectable()
export class LoginThrottlerGuard implements CanActivate {
  constructor(private loginThrottler: LoginThrottlerService) {}

  canActivate(context: ExecutionContext): boolean {
    const ip = this.extractIp(context);
    const blockInfo = this.loginThrottler.isBlocked(ip);

    if (blockInfo.blocked) {
      const minutes = Math.ceil(blockInfo.remainingMs / 60000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Demasiados intentos de inicio de sesión. Intente nuevamente en ${minutes} minutos.`,
          error: 'Too Many Requests',
          retryAfter: blockInfo.retryAfter?.toISOString(),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private extractIp(context: ExecutionContext): string {
    const type = context.getType<string>();

    if (type === 'graphql') {
      const gqlCtx = GqlExecutionContext.create(context);
      const req = gqlCtx.getContext().req;
      return this.getIpFromRequest(req);
    }

    const req = context.switchToHttp().getRequest();
    return this.getIpFromRequest(req);
  }

  private getIpFromRequest(req: Record<string, unknown>): string {
    const headers = req.headers as Record<string, string | string[]> | undefined;

    // Check for proxy headers
    const forwardedFor = headers?.['x-forwarded-for'];
    if (forwardedFor) {
      const clientIp = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : (forwardedFor as string).split(',')[0];
      return clientIp.trim();
    }

    const realIp = headers?.['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fall back to direct connection IP
    return (req.ip as string) || (req.socket as Record<string, unknown>)?.remoteAddress as string || 'unknown';
  }
}

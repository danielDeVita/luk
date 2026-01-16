import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Custom ThrottlerGuard that works with both REST and GraphQL contexts.
 *
 * Features:
 * - Extracts request from GraphQL context (default ThrottlerGuard doesn't)
 * - Per-user rate limiting: authenticated users tracked by user ID
 * - Anonymous requests tracked by IP address
 * - Prevents one user from affecting another user's rate limits
 */
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  /**
   * Extract request/response from the execution context.
   * Handles both GraphQL and REST contexts.
   */
  protected getRequestResponse(context: ExecutionContext): {
    req: Record<string, any>;
    res: Record<string, any>;
  } {
    const type = context.getType<string>();

    if (type === 'graphql') {
      const gqlCtx = GqlExecutionContext.create(context);
      const ctx = gqlCtx.getContext();
      return { req: ctx.req, res: ctx.res };
    }

    // For REST endpoints
    return {
      req: context.switchToHttp().getRequest(),
      res: context.switchToHttp().getResponse(),
    };
  }

  /**
   * Generate a unique tracker key for rate limiting.
   * - Authenticated users: tracked by "user:{userId}"
   * - Anonymous users: tracked by "ip:{ipAddress}"
   *
   * This ensures each user has their own rate limit bucket,
   * preventing one user from consuming another's quota.
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Check for authenticated user (set by JwtAuthGuard)
    const user = req.user;

    if (user?.id) {
      return `user:${user.id}`;
    }

    // Fall back to IP for anonymous requests
    const ip = this.extractIp(req);
    return `ip:${ip}`;
  }

  /**
   * Extract client IP address from request.
   * Handles common proxy headers (X-Forwarded-For, X-Real-IP).
   */
  private extractIp(req: Record<string, any>): string {
    // Check for proxy headers (common in production behind load balancer)
    const forwardedFor = req.headers?.['x-forwarded-for'];
    if (forwardedFor) {
      // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
      const clientIp = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0];
      return clientIp.trim();
    }

    const realIp = req.headers?.['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fall back to direct connection IP
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }
}

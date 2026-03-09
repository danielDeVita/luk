import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

interface LoginAttempt {
  count: number;
  firstAttempt: number;
  blockedUntil: number | null;
}

/**
 * Service to track failed login attempts and block IPs after too many failures.
 *
 * Configuration:
 * - MAX_ATTEMPTS: 5 failed attempts before blocking
 * - BLOCK_DURATION_MS: 15 minutes block duration
 * - WINDOW_MS: 15 minute window for counting attempts
 *
 * Uses in-memory storage with automatic cleanup.
 * For production with multiple instances, consider using Redis.
 */
@Injectable()
export class LoginThrottlerService implements OnModuleDestroy {
  private readonly logger = new Logger(LoginThrottlerService.name);
  private readonly cleanupInterval: NodeJS.Timeout;

  // Configuration
  private readonly MAX_ATTEMPTS = 5;
  private readonly BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  // In-memory storage for login attempts by IP
  private attempts: Map<string, LoginAttempt> = new Map();

  constructor() {
    // Periodic cleanup of expired entries
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      this.CLEANUP_INTERVAL_MS,
    );
    this.cleanupInterval.unref();
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }

  /**
   * Check if an IP is currently blocked.
   * Returns block info if blocked, null otherwise.
   */
  isBlocked(ip: string): {
    blocked: boolean;
    remainingMs: number;
    retryAfter: Date | null;
  } {
    // Bypass throttling in development, test, or CI mode to avoid blocking E2E tests
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'test' ||
      process.env.CI === 'true'
    ) {
      return { blocked: false, remainingMs: 0, retryAfter: null };
    }

    const attempt = this.attempts.get(ip);

    if (!attempt) {
      return { blocked: false, remainingMs: 0, retryAfter: null };
    }

    if (attempt.blockedUntil && attempt.blockedUntil > Date.now()) {
      const remainingMs = attempt.blockedUntil - Date.now();
      return {
        blocked: true,
        remainingMs,
        retryAfter: new Date(attempt.blockedUntil),
      };
    }

    return { blocked: false, remainingMs: 0, retryAfter: null };
  }

  /**
   * Record a failed login attempt.
   * Returns the remaining attempts before block, or null if now blocked.
   */
  recordFailedAttempt(ip: string): {
    remainingAttempts: number | null;
    blocked: boolean;
  } {
    // Bypass throttling in development, test, or CI mode to avoid blocking E2E tests
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'test' ||
      process.env.CI === 'true'
    ) {
      return { remainingAttempts: this.MAX_ATTEMPTS, blocked: false };
    }

    const now = Date.now();
    let attempt = this.attempts.get(ip);

    if (!attempt) {
      // First failed attempt
      attempt = {
        count: 1,
        firstAttempt: now,
        blockedUntil: null,
      };
      this.attempts.set(ip, attempt);
      this.logger.debug(
        `Failed login attempt 1/${this.MAX_ATTEMPTS} from IP: ${this.maskIp(ip)}`,
      );
      return { remainingAttempts: this.MAX_ATTEMPTS - 1, blocked: false };
    }

    // Check if we should reset the window
    if (now - attempt.firstAttempt > this.WINDOW_MS) {
      // Reset the window
      attempt.count = 1;
      attempt.firstAttempt = now;
      attempt.blockedUntil = null;
      this.logger.debug(
        `Reset login attempt window for IP: ${this.maskIp(ip)}`,
      );
      return { remainingAttempts: this.MAX_ATTEMPTS - 1, blocked: false };
    }

    // Increment attempt count
    attempt.count++;

    if (attempt.count >= this.MAX_ATTEMPTS) {
      // Block the IP
      attempt.blockedUntil = now + this.BLOCK_DURATION_MS;
      this.logger.warn(
        `IP blocked after ${attempt.count} failed login attempts: ${this.maskIp(ip)}. ` +
          `Blocked until: ${new Date(attempt.blockedUntil).toISOString()}`,
      );
      return { remainingAttempts: null, blocked: true };
    }

    const remaining = this.MAX_ATTEMPTS - attempt.count;
    this.logger.debug(
      `Failed login attempt ${attempt.count}/${this.MAX_ATTEMPTS} from IP: ${this.maskIp(ip)}`,
    );
    return { remainingAttempts: remaining, blocked: false };
  }

  /**
   * Clear failed attempts for an IP (called on successful login).
   */
  clearAttempts(ip: string): void {
    if (this.attempts.has(ip)) {
      this.attempts.delete(ip);
      this.logger.debug(`Cleared login attempts for IP: ${this.maskIp(ip)}`);
    }
  }

  /**
   * Get current stats (for monitoring).
   */
  getStats(): { trackedIps: number; blockedIps: number } {
    let blockedCount = 0;
    const now = Date.now();

    this.attempts.forEach((attempt) => {
      if (attempt.blockedUntil && attempt.blockedUntil > now) {
        blockedCount++;
      }
    });

    return {
      trackedIps: this.attempts.size,
      blockedIps: blockedCount,
    };
  }

  /**
   * Clean up expired entries.
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    this.attempts.forEach((attempt, ip) => {
      // Remove if window expired and not blocked
      const windowExpired = now - attempt.firstAttempt > this.WINDOW_MS;
      const blockExpired = !attempt.blockedUntil || attempt.blockedUntil < now;

      if (windowExpired && blockExpired) {
        this.attempts.delete(ip);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired login attempt records`);
    }
  }

  /**
   * Mask IP for logging (privacy).
   */
  private maskIp(ip: string): string {
    if (!ip) return 'unknown';
    // For IPv4: show first two octets
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.*`;
    }
    // For IPv6: show first group
    const ipv6Parts = ip.split(':');
    if (ipv6Parts.length > 2) {
      return `${ipv6Parts[0]}:${ipv6Parts[1]}:***`;
    }
    return ip.substring(0, 8) + '***';
  }
}

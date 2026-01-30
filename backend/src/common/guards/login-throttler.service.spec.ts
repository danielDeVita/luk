import { Test, TestingModule } from '@nestjs/testing';
import { LoginThrottlerService } from './login-throttler.service';

describe('LoginThrottlerService', () => {
  let service: LoginThrottlerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [LoginThrottlerService],
    }).compile();

    service = module.get<LoginThrottlerService>(LoginThrottlerService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('isBlocked', () => {
    it('should return blocked=false for unknown IP', () => {
      const result = service.isBlocked('192.168.1.1');

      expect(result.blocked).toBe(false);
      expect(result.remainingMs).toBe(0);
      expect(result.retryAfter).toBeNull();
    });

    it('should return blocked=false for expired block', () => {
      // Record enough attempts to block
      for (let i = 0; i < 5; i++) {
        service.recordFailedAttempt('192.168.1.1');
      }

      // Advance time past block duration (15 minutes)
      jest.advanceTimersByTime(16 * 60 * 1000);

      const result = service.isBlocked('192.168.1.1');

      expect(result.blocked).toBe(false);
      expect(result.remainingMs).toBe(0);
      expect(result.retryAfter).toBeNull();
    });

    it('should return blocked=true with remainingMs for active block', () => {
      // Record enough attempts to block
      for (let i = 0; i < 5; i++) {
        service.recordFailedAttempt('192.168.1.1');
      }

      // Advance 5 minutes (still blocked)
      jest.advanceTimersByTime(5 * 60 * 1000);

      const result = service.isBlocked('192.168.1.1');

      expect(result.blocked).toBe(true);
      expect(result.remainingMs).toBeGreaterThan(0);
      expect(result.remainingMs).toBeLessThan(15 * 60 * 1000);
      expect(result.retryAfter).toBeInstanceOf(Date);
    });
  });

  describe('recordFailedAttempt', () => {
    it('should initialize count=1 for new IP', () => {
      const result = service.recordFailedAttempt('192.168.1.1');

      expect(result.remainingAttempts).toBe(4);
      expect(result.blocked).toBe(false);
    });

    it('should return remainingAttempts correctly', () => {
      // First attempt
      let result = service.recordFailedAttempt('192.168.1.1');
      expect(result.remainingAttempts).toBe(4);
      expect(result.blocked).toBe(false);

      // Second attempt
      result = service.recordFailedAttempt('192.168.1.1');
      expect(result.remainingAttempts).toBe(3);
      expect(result.blocked).toBe(false);

      // Third attempt
      result = service.recordFailedAttempt('192.168.1.1');
      expect(result.remainingAttempts).toBe(2);
      expect(result.blocked).toBe(false);

      // Fourth attempt
      result = service.recordFailedAttempt('192.168.1.1');
      expect(result.remainingAttempts).toBe(1);
      expect(result.blocked).toBe(false);
    });

    it('should reset window after WINDOW_MS', () => {
      // First attempt
      service.recordFailedAttempt('192.168.1.1');

      // Advance past window (15 minutes + 1 second)
      jest.advanceTimersByTime(15 * 60 * 1000 + 1000);

      // Next attempt should reset count
      const result = service.recordFailedAttempt('192.168.1.1');
      expect(result.remainingAttempts).toBe(4); // Reset to 4 remaining
      expect(result.blocked).toBe(false);
    });

    it('should block after MAX_ATTEMPTS (5)', () => {
      // Record 5 failed attempts
      for (let i = 0; i < 4; i++) {
        service.recordFailedAttempt('192.168.1.1');
      }

      // 5th attempt should block
      const result = service.recordFailedAttempt('192.168.1.1');

      expect(result.remainingAttempts).toBeNull();
      expect(result.blocked).toBe(true);
    });

    it('should set blockedUntil correctly', () => {
      // Block the IP
      for (let i = 0; i < 5; i++) {
        service.recordFailedAttempt('192.168.1.1');
      }

      // Check that IP is blocked for ~15 minutes
      const blockInfo = service.isBlocked('192.168.1.1');
      expect(blockInfo.blocked).toBe(true);

      // Remaining time should be close to 15 minutes (900000ms)
      expect(blockInfo.remainingMs).toBeGreaterThan(14 * 60 * 1000);
      expect(blockInfo.remainingMs).toBeLessThanOrEqual(15 * 60 * 1000);
    });
  });

  describe('clearAttempts', () => {
    it('should remove IP from tracking', () => {
      // Record attempts
      service.recordFailedAttempt('192.168.1.1');
      service.recordFailedAttempt('192.168.1.1');

      // Clear attempts
      service.clearAttempts('192.168.1.1');

      // Next attempt should start fresh
      const result = service.recordFailedAttempt('192.168.1.1');
      expect(result.remainingAttempts).toBe(4);
    });

    it('should not throw for unknown IP', () => {
      expect(() => service.clearAttempts('unknown-ip')).not.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return correct trackedIps count', () => {
      service.recordFailedAttempt('192.168.1.1');
      service.recordFailedAttempt('192.168.1.2');
      service.recordFailedAttempt('192.168.1.3');

      const stats = service.getStats();
      expect(stats.trackedIps).toBe(3);
    });

    it('should return correct blockedIps count', () => {
      // Block 2 IPs
      for (let i = 0; i < 5; i++) {
        service.recordFailedAttempt('192.168.1.1');
        service.recordFailedAttempt('192.168.1.2');
      }

      // One IP not blocked
      service.recordFailedAttempt('192.168.1.3');

      const stats = service.getStats();
      expect(stats.trackedIps).toBe(3);
      expect(stats.blockedIps).toBe(2);
    });

    it('should return 0 for both when empty', () => {
      const stats = service.getStats();
      expect(stats.trackedIps).toBe(0);
      expect(stats.blockedIps).toBe(0);
    });

    it('should not count expired blocks', () => {
      // Block an IP
      for (let i = 0; i < 5; i++) {
        service.recordFailedAttempt('192.168.1.1');
      }

      let stats = service.getStats();
      expect(stats.blockedIps).toBe(1);

      // Advance past block duration
      jest.advanceTimersByTime(16 * 60 * 1000);

      stats = service.getStats();
      expect(stats.blockedIps).toBe(0); // Block expired
      expect(stats.trackedIps).toBe(1); // Still tracked until cleanup
    });
  });
});

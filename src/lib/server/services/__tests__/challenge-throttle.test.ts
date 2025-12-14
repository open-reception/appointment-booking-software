/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { challengeThrottleService } from "../challenge-throttle";

// Mock dependencies
vi.mock("$lib/server/db", () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };

  return {
    getTenantDb: vi.fn().mockResolvedValue(mockDb),
    getCentralDb: vi.fn(() => mockDb),
  };
});

vi.mock("$lib/logger", () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  return {
    default: mockLogger,
    logger: mockLogger,
  };
});

import { getTenantDb, getCentralDb } from "$lib/server/db";

describe("ChallengeThrottleService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PIN challenge throttling", () => {
    const tenantId = "tenant-123";
    const emailHash = "test-email-hash";

    it("should allow request when no throttle record exists", async () => {
      const mockDb = getCentralDb();
      (mockDb.limit as any).mockResolvedValue([]);

      const result = await challengeThrottleService.checkThrottle(emailHash, "pin", tenantId);

      expect(result.allowed).toBe(true);
      expect(result.retryAfterMs).toBe(0);
      expect(result.failedAttempts).toBe(0);
    });

    it("should allow request when throttle has expired", async () => {
      const mockDb = getCentralDb();
      const expiredRecord = {
        id: emailHash,
        failedAttempts: 3,
        lastAttemptAt: new Date(Date.now() - 10000),
        resetAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };
      (mockDb.limit as any).mockResolvedValue([expiredRecord]);

      const result = await challengeThrottleService.checkThrottle(emailHash, "pin", tenantId);

      expect(result.allowed).toBe(true);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("should throttle request when delay has not passed (1st failure)", async () => {
      const mockDb = getCentralDb();
      const now = Date.now();
      const record = {
        id: emailHash,
        failedAttempts: 1,
        lastAttemptAt: new Date(now - 1000), // 1 second ago
        resetAt: new Date(now + 60000), // 1 minute in future
      };
      (mockDb.limit as any).mockResolvedValue([record]);

      const result = await challengeThrottleService.checkThrottle(emailHash, "pin", tenantId);

      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(2000); // 2 seconds delay for 1st failure
    });

    it("should throttle request when delay has not passed (3rd failure)", async () => {
      const mockDb = getCentralDb();
      const now = Date.now();
      const record = {
        id: emailHash,
        failedAttempts: 3,
        lastAttemptAt: new Date(now - 10000), // 10 seconds ago
        resetAt: new Date(now + 60000), // 1 minute in future
      };
      (mockDb.limit as any).mockResolvedValue([record]);

      const result = await challengeThrottleService.checkThrottle(emailHash, "pin", tenantId);

      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(60000); // 60 seconds delay for 3rd failure
    });

    it("should allow request when enough time has passed", async () => {
      const mockDb = getCentralDb();
      const now = Date.now();
      const record = {
        id: emailHash,
        failedAttempts: 1,
        lastAttemptAt: new Date(now - 3000), // 3 seconds ago (more than 2 second delay)
        resetAt: new Date(now + 60000),
      };
      (mockDb.limit as any).mockResolvedValue([record]);

      const result = await challengeThrottleService.checkThrottle(emailHash, "pin", tenantId);

      expect(result.allowed).toBe(true);
      expect(result.failedAttempts).toBe(1);
    });

    it("should record first failed attempt", async () => {
      const mockDb = getCentralDb();
      (mockDb.limit as any).mockResolvedValue([]);

      await challengeThrottleService.recordFailedAttempt(emailHash, "pin", tenantId);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          id: emailHash,
          failedAttempts: 1,
        }),
      );
    });

    it("should increment failed attempts on subsequent failures", async () => {
      const mockDb = getCentralDb();
      const record = {
        id: emailHash,
        failedAttempts: 2,
        lastAttemptAt: new Date(),
        resetAt: new Date(Date.now() + 60000),
      };
      (mockDb.limit as any).mockResolvedValue([record]);

      await challengeThrottleService.recordFailedAttempt(emailHash, "pin", tenantId);

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          failedAttempts: 3,
        }),
      );
    });

    it("should clear throttle on successful authentication", async () => {
      const mockDb = getCentralDb();

      await challengeThrottleService.clearThrottle(emailHash, "pin", tenantId);

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe("Passkey challenge throttling", () => {
    const email = "test@example.com";

    it("should allow first 3 attempts immediately", async () => {
      const mockDb = getCentralDb();
      const record = {
        id: email,
        failedAttempts: 2,
        lastAttemptAt: new Date(Date.now() - 100),
        resetAt: new Date(Date.now() + 60000),
      };
      (mockDb.limit as any).mockResolvedValue([record]);

      const result = await challengeThrottleService.checkThrottle(email, "passkey");

      expect(result.allowed).toBe(true);
      expect(result.retryAfterMs).toBe(0);
    });

    it("should throttle after 3 failed attempts", async () => {
      const mockDb = getCentralDb();
      const now = Date.now();
      const record = {
        id: email,
        failedAttempts: 3,
        lastAttemptAt: new Date(now - 10000), // 10 seconds ago
        resetAt: new Date(now + 60000),
      };
      (mockDb.limit as any).mockResolvedValue([record]);

      const result = await challengeThrottleService.checkThrottle(email, "passkey");

      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(60000); // 1 minute delay
    });

    it("should allow request after 1 minute has passed", async () => {
      const mockDb = getCentralDb();
      const now = Date.now();
      const record = {
        id: email,
        failedAttempts: 3,
        lastAttemptAt: new Date(now - 70000), // 70 seconds ago (more than 1 minute)
        resetAt: new Date(now + 60000),
      };
      (mockDb.limit as any).mockResolvedValue([record]);

      const result = await challengeThrottleService.checkThrottle(email, "passkey");

      expect(result.allowed).toBe(true);
    });

    it("should record failed passkey attempts", async () => {
      const mockDb = getCentralDb();
      (mockDb.limit as any).mockResolvedValue([]);

      await challengeThrottleService.recordFailedAttempt(email, "passkey");

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should clear passkey throttle on success", async () => {
      const mockDb = getCentralDb();

      await challengeThrottleService.clearThrottle(email, "passkey");

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe("Edge cases", () => {
    it("should handle cleanup of expired records", async () => {
      const mockDb = getCentralDb();

      await challengeThrottleService.cleanupExpired();

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});

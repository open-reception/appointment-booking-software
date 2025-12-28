/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies BEFORE importing the service
vi.mock("$lib/server/db", () => {
  return {
    centralDb: {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
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

import { challengeThrottleService } from "../challenge-throttle";

describe("ChallengeThrottleService", () => {
  let mockCentralDb: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get the mocked centralDb module
    const dbModule = await vi.importMock("$lib/server/db");
    mockCentralDb = dbModule.centralDb;
  });

  describe("PIN challenge throttling", () => {
    const emailHash = "test-email-hash";

    it("should allow request when no throttle record exists", async () => {
      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      mockCentralDb.select.mockReturnValue(mockSelectBuilder);

      const result = await challengeThrottleService.checkThrottle(emailHash, "pin");

      expect(result.allowed).toBe(true);
      expect(result.retryAfterMs).toBe(0);
      expect(result.failedAttempts).toBe(0);
    });

    it("should allow request when throttle has expired", async () => {
      const expiredRecord = {
        id: emailHash,
        failedAttempts: 3,
        lastAttemptAt: new Date(Date.now() - 10000),
        resetAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([expiredRecord]),
      };

      const mockDeleteBuilder = {
        where: vi.fn().mockResolvedValue(undefined),
      };

      mockCentralDb.select.mockReturnValue(mockSelectBuilder);
      mockCentralDb.delete.mockReturnValue(mockDeleteBuilder);

      const result = await challengeThrottleService.checkThrottle(emailHash, "pin");

      expect(result.allowed).toBe(true);
      expect(mockCentralDb.delete).toHaveBeenCalled();
    });

    it("should throttle request when delay has not passed (1st failure)", async () => {
      const now = Date.now();
      const record = {
        id: emailHash,
        failedAttempts: 4, // 4th attempt triggers throttling (1 minute delay)
        lastAttemptAt: new Date(now - 30000), // 30 seconds ago (less than 1 minute)
        resetAt: new Date(now + 30000), // 30 seconds in future
      };

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([record]),
      };

      mockCentralDb.select.mockReturnValue(mockSelectBuilder);

      const result = await challengeThrottleService.checkThrottle(emailHash, "pin");

      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(60000); // 1 minute delay for 4th failure
    });

    it("should throttle request when delay has not passed (3rd failure)", async () => {
      const now = Date.now();
      const record = {
        id: emailHash,
        failedAttempts: 5, // 5th attempt triggers 5 minute delay
        lastAttemptAt: new Date(now - 120000), // 2 minutes ago (less than 5 minutes)
        resetAt: new Date(now + 180000), // 3 minutes in future
      };

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([record]),
      };

      mockCentralDb.select.mockReturnValue(mockSelectBuilder);

      const result = await challengeThrottleService.checkThrottle(emailHash, "pin");

      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(300000); // 5 minutes delay for 5th failure
    });

    it("should allow request when enough time has passed", async () => {
      const now = Date.now();
      const record = {
        id: emailHash,
        failedAttempts: 1,
        lastAttemptAt: new Date(now - 3000), // 3 seconds ago (more than 2 second delay)
        resetAt: new Date(now + 60000),
      };

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([record]),
      };

      mockCentralDb.select.mockReturnValue(mockSelectBuilder);

      const result = await challengeThrottleService.checkThrottle(emailHash, "pin");

      expect(result.allowed).toBe(true);
      expect(result.failedAttempts).toBe(1);
    });

    it("should record first failed attempt", async () => {
      const mockInsertBuilder = {
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      };

      mockCentralDb.insert.mockReturnValue(mockInsertBuilder);

      await challengeThrottleService.recordFailedAttempt(emailHash, "pin");

      expect(mockCentralDb.insert).toHaveBeenCalled();
      expect(mockInsertBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          id: emailHash,
          failedAttempts: 1,
        }),
      );
    });

    it("should increment failed attempts on subsequent failures", async () => {
      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: emailHash,
            failedAttempts: 2,
            lastAttemptAt: new Date(),
            resetAt: new Date(Date.now() + 60000),
          },
        ]),
      };

      const mockInsertBuilder = {
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      };

      mockCentralDb.select.mockReturnValue(mockSelectBuilder);
      mockCentralDb.insert.mockReturnValue(mockInsertBuilder);

      await challengeThrottleService.recordFailedAttempt(emailHash, "pin");

      expect(mockCentralDb.insert).toHaveBeenCalled();
      expect(mockInsertBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          id: emailHash,
          failedAttempts: 1,
        }),
      );
    });

    it("should clear throttle on successful authentication", async () => {
      const mockDeleteBuilder = {
        where: vi.fn().mockResolvedValue(undefined),
      };

      mockCentralDb.delete.mockReturnValue(mockDeleteBuilder);

      await challengeThrottleService.clearThrottle(emailHash, "pin");

      expect(mockCentralDb.delete).toHaveBeenCalled();
    });
  });

  describe("Passkey challenge throttling", () => {
    const email = "test@example.com";

    it("should allow first 3 attempts immediately", async () => {
      const record = {
        id: email,
        failedAttempts: 2,
        lastAttemptAt: new Date(Date.now() - 100),
        resetAt: new Date(Date.now() + 60000),
      };

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([record]),
      };

      mockCentralDb.select.mockReturnValue(mockSelectBuilder);

      const result = await challengeThrottleService.checkThrottle(email, "passkey");

      expect(result.allowed).toBe(true);
      expect(result.retryAfterMs).toBe(0);
    });

    it("should throttle after 3 failed attempts", async () => {
      const now = Date.now();
      const record = {
        id: email,
        failedAttempts: 3,
        lastAttemptAt: new Date(now - 10000), // 10 seconds ago
        resetAt: new Date(now + 60000),
      };

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([record]),
      };

      mockCentralDb.select.mockReturnValue(mockSelectBuilder);

      const result = await challengeThrottleService.checkThrottle(email, "passkey");

      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(60000); // 1 minute delay
    });

    it("should allow request after 1 minute has passed", async () => {
      const now = Date.now();
      const record = {
        id: email,
        failedAttempts: 3,
        lastAttemptAt: new Date(now - 70000), // 70 seconds ago (more than 1 minute)
        resetAt: new Date(now + 60000),
      };

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([record]),
      };

      mockCentralDb.select.mockReturnValue(mockSelectBuilder);

      const result = await challengeThrottleService.checkThrottle(email, "passkey");

      expect(result.allowed).toBe(true);
    });

    it("should record failed passkey attempts", async () => {
      const mockInsertBuilder = {
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      };

      mockCentralDb.insert.mockReturnValue(mockInsertBuilder);

      await challengeThrottleService.recordFailedAttempt(email, "passkey");

      expect(mockCentralDb.insert).toHaveBeenCalled();
    });

    it("should clear passkey throttle on success", async () => {
      const mockDeleteBuilder = {
        where: vi.fn().mockResolvedValue(undefined),
      };

      mockCentralDb.delete.mockReturnValue(mockDeleteBuilder);

      await challengeThrottleService.clearThrottle(email, "passkey");

      expect(mockCentralDb.delete).toHaveBeenCalled();
    });
  });

  describe("Edge cases", () => {
    it("should handle cleanup of expired records", async () => {
      const mockDeleteBuilder = {
        where: vi.fn().mockResolvedValue(undefined),
      };

      mockCentralDb.delete.mockReturnValue(mockDeleteBuilder);

      await challengeThrottleService.cleanupExpired();

      expect(mockCentralDb.delete).toHaveBeenCalled();
    });
  });
});

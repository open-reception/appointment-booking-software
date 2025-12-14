/**
 * Challenge Throttling Service
 *
 * Implements throttling for challenge-based authentication to prevent brute force attacks.
 * - PIN challenges (appointments): Exponential backoff (2 seconds, 10 seconds, 60 seconds, up to 30 minutes)
 * - Passkey challenges (auth): Fixed delay after 3 attempts (1 minute)
 */

import { getTenantDb, getCentralDb } from "$lib/server/db";
import { challengeThrottle } from "$lib/server/db/tenant-schema";
import { passkeyChallengeThrottle } from "$lib/server/db/central-schema";
import { eq, lt } from "drizzle-orm";
import { logger } from "$lib/logger";

export type ThrottleType = "pin" | "passkey";

interface ThrottleResult {
  allowed: boolean;
  retryAfterMs: number;
  failedAttempts: number;
}

// Throttle reset duration: 1 hour
const THROTTLE_RESET_DURATION_MS = 60 * 60 * 1000;

/**
 * Calculate escalating delay for PIN challenges
 * Uses a fixed escalation pattern that increases with each failed attempt:
 * - 1st failure: 2 seconds
 * - 2nd failure: 10 seconds
 * - 3rd failure: 1 minute
 * - 4th failure: 5 minutes
 * - 5+ failures: 30 minutes
 */
function calculatePinThrottleDelay(failedAttempts: number): number {
  if (failedAttempts === 0) return 0;
  if (failedAttempts === 1) return 2 * 1000; // 2 seconds
  if (failedAttempts === 2) return 10 * 1000; // 10 seconds
  if (failedAttempts === 3) return 60 * 1000; // 1 minute
  if (failedAttempts === 4) return 5 * 60 * 1000; // 5 minutes
  if (failedAttempts >= 5) return 30 * 60 * 1000; // 30 minutes
  return 0;
}

/**
 * Calculate throttle delay for passkey challenges
 * First 3 tries: immediate
 * Afterwards: wait for one minute
 */
function calculatePasskeyThrottleDelay(failedAttempts: number): number {
  if (failedAttempts < 3) return 0;
  return 60 * 1000; // 1 minute
}

class ChallengeThrottleService {
  /**
   * Check if a challenge request should be throttled
   * @param identifier - Email hash for PIN challenges, email for passkey challenges
   * @param type - Type of challenge (pin or passkey)
   * @param tenantId - Tenant ID (required for PIN challenges, optional for passkey)
   */
  async checkThrottle(
    identifier: string,
    type: ThrottleType,
    tenantId?: string,
  ): Promise<ThrottleResult> {
    const now = new Date();

    if (type === "pin") {
      if (!tenantId) {
        throw new Error("Tenant ID required for PIN challenge throttling");
      }

      const db = await getTenantDb(tenantId);

      // Get throttle record
      const records = await db
        .select()
        .from(challengeThrottle)
        .where(eq(challengeThrottle.id, identifier))
        .limit(1);

      if (records.length === 0) {
        // No throttle record, allow request
        return { allowed: true, retryAfterMs: 0, failedAttempts: 0 };
      }

      const record = records[0];

      // Check if throttle has expired
      if (now > record.resetAt) {
        // Throttle expired, clean up and allow
        await db.delete(challengeThrottle).where(eq(challengeThrottle.id, identifier));
        return { allowed: true, retryAfterMs: 0, failedAttempts: 0 };
      }

      // Calculate how long to wait
      const delay = calculatePinThrottleDelay(record.failedAttempts);
      const timeSinceLastAttempt = now.getTime() - record.lastAttemptAt.getTime();

      if (timeSinceLastAttempt < delay) {
        // Still throttled
        return {
          allowed: false,
          retryAfterMs: delay - timeSinceLastAttempt,
          failedAttempts: record.failedAttempts,
        };
      }

      // Enough time has passed, allow the request
      return {
        allowed: true,
        retryAfterMs: 0,
        failedAttempts: record.failedAttempts,
      };
    } else {
      // Passkey throttling (central DB)
      const db = getCentralDb();

      const records = await db
        .select()
        .from(passkeyChallengeThrottle)
        .where(eq(passkeyChallengeThrottle.id, identifier))
        .limit(1);

      if (records.length === 0) {
        // No throttle record, allow request
        return { allowed: true, retryAfterMs: 0, failedAttempts: 0 };
      }

      const record = records[0];

      // Check if throttle has expired
      if (now > record.resetAt) {
        // Throttle expired, clean up and allow
        await db
          .delete(passkeyChallengeThrottle)
          .where(eq(passkeyChallengeThrottle.id, identifier));
        return { allowed: true, retryAfterMs: 0, failedAttempts: 0 };
      }

      // Calculate how long to wait
      const delay = calculatePasskeyThrottleDelay(record.failedAttempts);
      const timeSinceLastAttempt = now.getTime() - record.lastAttemptAt.getTime();

      if (timeSinceLastAttempt < delay) {
        // Still throttled
        return {
          allowed: false,
          retryAfterMs: delay - timeSinceLastAttempt,
          failedAttempts: record.failedAttempts,
        };
      }

      // Enough time has passed, allow the request
      return {
        allowed: true,
        retryAfterMs: 0,
        failedAttempts: record.failedAttempts,
      };
    }
  }

  /**
   * Record a failed challenge attempt
   * @param identifier - Email hash for PIN challenges, email for passkey challenges
   * @param type - Type of challenge (pin or passkey)
   * @param tenantId - Tenant ID (required for PIN challenges)
   */
  async recordFailedAttempt(
    identifier: string,
    type: ThrottleType,
    tenantId?: string,
  ): Promise<void> {
    const now = new Date();

    if (type === "pin") {
      if (!tenantId) {
        throw new Error("Tenant ID required for PIN challenge throttling");
      }

      const db = await getTenantDb(tenantId);

      // Try to get existing record
      const records = await db
        .select()
        .from(challengeThrottle)
        .where(eq(challengeThrottle.id, identifier))
        .limit(1);

      if (records.length === 0) {
        // Create new throttle record
        const resetAt = new Date(now.getTime() + THROTTLE_RESET_DURATION_MS);
        await db.insert(challengeThrottle).values({
          id: identifier,
          failedAttempts: 1,
          lastAttemptAt: now,
          resetAt,
        });
      } else {
        // Update existing record
        const record = records[0];
        await db
          .update(challengeThrottle)
          .set({
            failedAttempts: record.failedAttempts + 1,
            lastAttemptAt: now,
          })
          .where(eq(challengeThrottle.id, identifier));
      }

      logger.info("Recorded failed PIN challenge attempt", {
        identifier: identifier.slice(0, 8),
        tenantId,
      });
    } else {
      // Passkey throttling (central DB)
      const db = getCentralDb();

      const records = await db
        .select()
        .from(passkeyChallengeThrottle)
        .where(eq(passkeyChallengeThrottle.id, identifier))
        .limit(1);

      if (records.length === 0) {
        // Create new throttle record
        const resetAt = new Date(now.getTime() + THROTTLE_RESET_DURATION_MS);
        await db.insert(passkeyChallengeThrottle).values({
          id: identifier,
          failedAttempts: 1,
          lastAttemptAt: now,
          resetAt,
        });
      } else {
        // Update existing record
        const record = records[0];
        await db
          .update(passkeyChallengeThrottle)
          .set({
            failedAttempts: record.failedAttempts + 1,
            lastAttemptAt: now,
          })
          .where(eq(passkeyChallengeThrottle.id, identifier));
      }

      logger.info("Recorded failed passkey challenge attempt", {
        identifier: identifier.slice(0, 8),
      });
    }
  }

  /**
   * Clear throttle for successful authentication
   * @param identifier - Email hash for PIN challenges, email for passkey challenges
   * @param type - Type of challenge (pin or passkey)
   * @param tenantId - Tenant ID (required for PIN challenges)
   */
  async clearThrottle(identifier: string, type: ThrottleType, tenantId?: string): Promise<void> {
    if (type === "pin") {
      if (!tenantId) {
        throw new Error("Tenant ID required for PIN challenge throttling");
      }

      const db = await getTenantDb(tenantId);
      await db.delete(challengeThrottle).where(eq(challengeThrottle.id, identifier));

      logger.debug("Cleared PIN challenge throttle", {
        identifier: identifier.slice(0, 8),
        tenantId,
      });
    } else {
      const db = getCentralDb();
      await db.delete(passkeyChallengeThrottle).where(eq(passkeyChallengeThrottle.id, identifier));

      logger.debug("Cleared passkey challenge throttle", {
        identifier: identifier.slice(0, 8),
      });
    }
  }

  /**
   * Clean up expired throttle records
   * Should be called periodically
   */
  async cleanupExpired(type: ThrottleType, tenantId?: string): Promise<void> {
    const now = new Date();

    try {
      if (type === "pin") {
        if (!tenantId) {
          throw new Error("Tenant ID required for PIN challenge throttle cleanup");
        }

        const db = await getTenantDb(tenantId);
        await db.delete(challengeThrottle).where(lt(challengeThrottle.resetAt, now));

        logger.debug("Cleaned up expired PIN challenge throttles", { tenantId });
      } else {
        const db = getCentralDb();
        await db.delete(passkeyChallengeThrottle).where(lt(passkeyChallengeThrottle.resetAt, now));

        logger.debug("Cleaned up expired passkey challenge throttles");
      }
    } catch (error) {
      logger.warn("Failed to cleanup expired throttles", {
        type,
        tenantId,
        error: String(error),
      });
    }
  }
}

export const challengeThrottleService = new ChallengeThrottleService();

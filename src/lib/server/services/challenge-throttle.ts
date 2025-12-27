/**
 * Challenge Throttling Service
 *
 * Implements throttling for challenge-based authentication to prevent brute force attacks.
 * All throttle data is stored centrally in the central database.
 * - PIN challenges (appointments): Escalating delays (2s, 10s, 1m, 5m, 30m)
 * - Passkey challenges (auth): Fixed delay after 3 attempts (1 minute)
 */

import { centralDb } from "$lib/server/db";
import { challengeThrottle } from "$lib/server/db/central-schema";
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
 */
function calculatePinThrottleDelay(failedAttempts: number): number {
  if (failedAttempts < 4) return 0;
  if (failedAttempts === 4) return 60 * 1000; // 1 minute
  if (failedAttempts === 5) return 5 * 60 * 1000; // 5 minutes
  if (failedAttempts === 6) return 30 * 60 * 1000; // 30 minutes
  if (failedAttempts >= 7) return 60 * 60 * 1000; // 60 minutes
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
   */
  async checkThrottle(identifier: string, type: ThrottleType): Promise<ThrottleResult> {
    const now = new Date();

    // Get throttle record from central DB
    const records = await centralDb
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
      await centralDb.delete(challengeThrottle).where(eq(challengeThrottle.id, identifier));
      return { allowed: true, retryAfterMs: 0, failedAttempts: 0 };
    }

    // Calculate how long to wait based on challenge type
    const delay =
      type === "pin"
        ? calculatePinThrottleDelay(record.failedAttempts)
        : calculatePasskeyThrottleDelay(record.failedAttempts);
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

  /**
   * Record a failed challenge attempt
   * @param identifier - Email hash for PIN challenges, email for passkey challenges
   * @param type - Type of challenge (pin or passkey)
   */
  async recordFailedAttempt(identifier: string, type: ThrottleType): Promise<void> {
    const now = new Date();

    // Try to get existing record
    const records = await centralDb
      .select()
      .from(challengeThrottle)
      .where(eq(challengeThrottle.id, identifier))
      .limit(1);

    if (records.length === 0) {
      // Create new throttle record
      const resetAt = new Date(now.getTime() + THROTTLE_RESET_DURATION_MS);
      await centralDb.insert(challengeThrottle).values({
        id: identifier,
        failedAttempts: 1,
        lastAttemptAt: now,
        resetAt,
      });
    } else {
      // Update existing record
      const record = records[0];
      await centralDb
        .update(challengeThrottle)
        .set({
          failedAttempts: record.failedAttempts + 1,
          lastAttemptAt: now,
        })
        .where(eq(challengeThrottle.id, identifier));
    }

    logger.info(`Recorded failed ${type} challenge attempt`, {
      identifier: identifier.slice(0, 8),
      type,
    });
  }

  /**
   * Clear throttle for successful authentication
   * @param identifier - Email hash for PIN challenges, email for passkey challenges
   * @param type - Type of challenge (pin or passkey)
   */
  async clearThrottle(identifier: string, type: ThrottleType): Promise<void> {
    await centralDb.delete(challengeThrottle).where(eq(challengeThrottle.id, identifier));

    logger.debug(`Cleared ${type} challenge throttle`, {
      identifier: identifier.slice(0, 8),
      type,
    });
  }

  /**
   * Clean up expired throttle records
   * Should be called periodically
   */
  async cleanupExpired(): Promise<void> {
    const now = new Date();

    try {
      await centralDb.delete(challengeThrottle).where(lt(challengeThrottle.resetAt, now));

      logger.debug("Cleaned up expired challenge throttles");
    } catch (error) {
      logger.warn("Failed to cleanup expired throttles", {
        error: String(error),
      });
    }
  }
}

export const challengeThrottleService = new ChallengeThrottleService();

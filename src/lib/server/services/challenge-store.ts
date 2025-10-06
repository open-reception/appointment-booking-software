/**
 * Database-backed Challenge Storage
 *
 * Stores authentication challenges in the tenant database for persistence and scalability.
 */

import { getTenantDb } from "$lib/server/db";
import { authChallenge } from "$lib/server/db/tenant-schema";
import { eq, and, lt, gt } from "drizzle-orm";
import { logger } from "$lib/logger";

interface StoredChallenge {
  challenge: string;
  emailHash: string;
  createdAt: Date;
  expiresAt: Date;
}

class ChallengeStore {
  private readonly CHALLENGE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Store a challenge in the tenant database
   */
  async store(
    challengeId: string,
    challenge: string,
    emailHash: string,
    tenantId: string,
  ): Promise<void> {
    const db = await getTenantDb(tenantId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.CHALLENGE_TTL);

    await db.insert(authChallenge).values({
      id: challengeId,
      challenge,
      emailHash,
      createdAt: now,
      expiresAt,
      consumed: false,
    });

    // Clean up expired challenges periodically
    await this.cleanup(tenantId);
  }

  /**
   * Retrieve and consume a challenge (one-time use)
   */
  async consume(challengeId: string, tenantId: string): Promise<StoredChallenge | null> {
    const db = await getTenantDb(tenantId);
    const now = new Date();

    // Find the challenge
    const results = await db
      .select({
        challenge: authChallenge.challenge,
        emailHash: authChallenge.emailHash,
        createdAt: authChallenge.createdAt,
        expiresAt: authChallenge.expiresAt,
        consumed: authChallenge.consumed,
      })
      .from(authChallenge)
      .where(eq(authChallenge.id, challengeId))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const result = results[0];

    // Check if expired or already consumed
    if (now > result.expiresAt || result.consumed) {
      // Delete expired/consumed challenge
      await db.delete(authChallenge).where(eq(authChallenge.id, challengeId));
      return null;
    }

    // Mark as consumed (one-time use)
    await db.update(authChallenge).set({ consumed: true }).where(eq(authChallenge.id, challengeId));

    return {
      challenge: result.challenge,
      emailHash: result.emailHash,
      createdAt: result.createdAt,
      expiresAt: result.expiresAt,
    };
  }

  /**
   * Clean up expired and consumed challenges
   */
  private async cleanup(tenantId: string): Promise<void> {
    try {
      const db = await getTenantDb(tenantId);
      const now = new Date();

      await db.delete(authChallenge).where(lt(authChallenge.expiresAt, now));

      logger.debug("Cleaned up expired challenges", {
        tenantId,
      });
    } catch (error) {
      logger.warn("Failed to cleanup expired challenges", {
        tenantId,
        error: String(error),
      });
    }
  }

  /**
   * Get current number of active challenges for a tenant (for debugging)
   */
  async size(tenantId: string): Promise<number> {
    const db = await getTenantDb(tenantId);
    const now = new Date();

    const results = await db
      .select({ count: authChallenge.id })
      .from(authChallenge)
      .where(and(eq(authChallenge.consumed, false), gt(authChallenge.expiresAt, now)));

    return results.length;
  }
}

export const challengeStore = new ChallengeStore();

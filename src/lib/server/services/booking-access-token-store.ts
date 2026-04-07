import { and, eq, lt } from "drizzle-orm";
import { logger } from "$lib/logger";
import { getTenantDb } from "$lib/server/db";
import { bookingAccessToken } from "$lib/server/db/tenant-schema";

interface StoreBookingTokenInput {
  id: string;
  scope: string;
  tenantId: string;
  emailHash?: string;
  tunnelId: string;
  clientPublicKey?: string;
  expiresAt: Date;
}

class BookingAccessTokenStore {
  async store(input: StoreBookingTokenInput): Promise<void> {
    const db = await getTenantDb(input.tenantId);

    await db.insert(bookingAccessToken).values({
      id: input.id,
      scope: input.scope,
      tenantId: input.tenantId,
      emailHash: input.emailHash,
      tunnelId: input.tunnelId,
      clientPublicKey: input.clientPublicKey,
      expiresAt: input.expiresAt,
      consumed: false,
    });

    await this.cleanup(input.tenantId);
  }

  async isActive(input: { id: string; tenantId: string; scope: string }): Promise<boolean> {
    const db = await getTenantDb(input.tenantId);

    const rows = await db
      .select({ id: bookingAccessToken.id, expiresAt: bookingAccessToken.expiresAt })
      .from(bookingAccessToken)
      .where(
        and(
          eq(bookingAccessToken.id, input.id),
          eq(bookingAccessToken.tenantId, input.tenantId),
          eq(bookingAccessToken.scope, input.scope),
          eq(bookingAccessToken.consumed, false),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      return false;
    }

    if (rows[0].expiresAt < new Date()) {
      await db.delete(bookingAccessToken).where(eq(bookingAccessToken.id, input.id));
      return false;
    }

    return true;
  }

  async consume(input: { id: string; tenantId: string; scope: string }): Promise<boolean> {
    const db = await getTenantDb(input.tenantId);

    const result = await db
      .update(bookingAccessToken)
      .set({ consumed: true })
      .where(
        and(
          eq(bookingAccessToken.id, input.id),
          eq(bookingAccessToken.tenantId, input.tenantId),
          eq(bookingAccessToken.scope, input.scope),
          eq(bookingAccessToken.consumed, false),
        ),
      )
      .returning({ id: bookingAccessToken.id });

    return result.length > 0;
  }

  private async cleanup(tenantId: string): Promise<void> {
    try {
      const db = await getTenantDb(tenantId);
      const now = new Date();

      await db.delete(bookingAccessToken).where(lt(bookingAccessToken.expiresAt, now));
    } catch (error) {
      logger.warn("Failed to cleanup expired booking access tokens", {
        tenantId,
        error: String(error),
      });
    }
  }
}

export const bookingAccessTokenStore = new BookingAccessTokenStore();

import { db } from "$lib/server/db";
import {
  userInvite,
  tenant,
  type InsertUserInvite,
  type SelectUserInvite,
} from "$lib/server/db/central-schema";
import { eq, and, lt } from "drizzle-orm";
import { UniversalLogger } from "$lib/logger";

const logger = new UniversalLogger().setContext("InviteService");

export class InviteService {
  /**
   * Create a new user invitation
   * @param email Email address of the invited user
   * @param name Name of the invited user
   * @param role Role to assign (TENANT_ADMIN or STAFF)
   * @param tenantId Tenant ID the user is being invited to
   * @param invitedBy User ID of who sent the invitation
   * @param language Language preference for the invitation
   * @returns The created invitation with invite code
   */
  static async createInvite(
    email: string,
    name: string,
    role: "TENANT_ADMIN" | "STAFF",
    tenantId: string,
    invitedBy: string,
    language: "de" | "en" = "de",
  ): Promise<SelectUserInvite> {
    try {
      // Set expiration to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const inviteData: InsertUserInvite = {
        email,
        name,
        role,
        tenantId,
        invitedBy,
        language,
        expiresAt,
        used: false,
      };

      const [createdInvite] = await db.insert(userInvite).values(inviteData).returning();

      logger.info("User invitation created", {
        inviteId: createdInvite.id,
        inviteCode: createdInvite.inviteCode,
        email: createdInvite.email,
        tenantId: createdInvite.tenantId,
        role: createdInvite.role,
        invitedBy: createdInvite.invitedBy,
      });

      return createdInvite;
    } catch (error) {
      logger.error("Failed to create user invitation", { error, email, tenantId, role });
      throw new Error(`Failed to create invitation: ${error}`);
    }
  }

  /**
   * Get an invitation by invite code
   * @param inviteCode The secure invite code
   * @returns The invitation with tenant information, or null if not found/expired
   */
  static async getInviteByCode(
    inviteCode: string,
  ): Promise<(SelectUserInvite & { tenant: typeof tenant.$inferSelect }) | null> {
    try {
      const result = await db
        .select({
          invite: userInvite,
          tenant: tenant,
        })
        .from(userInvite)
        .innerJoin(tenant, eq(userInvite.tenantId, tenant.id))
        .where(and(eq(userInvite.inviteCode, inviteCode), eq(userInvite.used, false)))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const invitation = result[0];

      // Check if invitation has expired
      if (invitation.invite.expiresAt < new Date()) {
        logger.warn("Attempted to use expired invitation", {
          inviteCode,
          expiresAt: invitation.invite.expiresAt,
        });
        return null;
      }

      return {
        ...invitation.invite,
        tenant: invitation.tenant,
      };
    } catch (error) {
      logger.error("Failed to get invitation by code", { error, inviteCode });
      throw new Error(`Failed to retrieve invitation: ${error}`);
    }
  }

  /**
   * Mark an invitation as used
   * @param inviteCode The invite code to mark as used
   * @param createdUserId The ID of the user that was created from this invitation
   * @returns The updated invitation
   */
  static async markInviteAsUsed(
    inviteCode: string,
    createdUserId: string,
  ): Promise<SelectUserInvite> {
    try {
      const [updatedInvite] = await db
        .update(userInvite)
        .set({
          used: true,
          usedAt: new Date(),
          createdUserId,
          updatedAt: new Date(),
        })
        .where(eq(userInvite.inviteCode, inviteCode))
        .returning();

      if (!updatedInvite) {
        throw new Error("Invitation not found");
      }

      logger.info("Invitation marked as used", {
        inviteCode,
        createdUserId,
        email: updatedInvite.email,
      });

      return updatedInvite;
    } catch (error) {
      logger.error("Failed to mark invitation as used", { error, inviteCode, createdUserId });
      throw new Error(`Failed to update invitation: ${error}`);
    }
  }

  /**
   * Check if an email already has a pending invitation for a tenant
   * @param email Email address to check
   * @param tenantId Tenant ID to check
   * @returns True if there's already a pending invitation
   */
  static async hasPendingInvite(email: string, tenantId: string): Promise<boolean> {
    try {
      const result = await db
        .select({ id: userInvite.id })
        .from(userInvite)
        .where(
          and(
            eq(userInvite.email, email),
            eq(userInvite.tenantId, tenantId),
            eq(userInvite.used, false),
          ),
        )
        .limit(1);

      return result.length > 0;
    } catch (error) {
      logger.error("Failed to check for pending invitations", { error, email, tenantId });
      throw new Error(`Failed to check pending invitations: ${error}`);
    }
  }

  /**
   * Delete expired invitations (cleanup task)
   * @returns Number of deleted invitations
   */
  static async cleanupExpiredInvites(): Promise<number> {
    try {
      const result = await db.delete(userInvite).where(
        and(
          eq(userInvite.used, false),
          // Delete invitations that expired more than 1 day ago
          lt(userInvite.expiresAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
        ),
      );

      const deletedCount = result.length || 0;

      if (deletedCount > 0) {
        logger.info("Cleaned up expired invitations", { deletedCount });
      }

      return deletedCount;
    } catch (error) {
      logger.error("Failed to cleanup expired invitations", { error });
      throw new Error(`Failed to cleanup invitations: ${error}`);
    }
  }
}

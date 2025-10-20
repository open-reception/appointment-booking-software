import { centralDb, getTenantDb } from "../db";
import { user, userInvite, userPasskey } from "../db/central-schema";
import { clientTunnelStaffKeyShare } from "../db/tenant-schema";
import { eq, and } from "drizzle-orm";
import { NotFoundError, ValidationError, InternalError } from "../utils/errors";
import { StaffCryptoService } from "./staff-crypto.service";
import { UniversalLogger } from "$lib/logger";
import type { InferSelectModel } from "drizzle-orm";

const logger = new UniversalLogger().setContext("StaffService");

export type SelectUser = InferSelectModel<typeof user>;

export interface StaffMember {
  id: string;
  email: string;
  name: string;
  role: "GLOBAL_ADMIN" | "TENANT_ADMIN" | "STAFF";
  isActive: boolean | null;
  confirmationState: "INVITED" | "CONFIRMED" | "ACCESS_GRANTED" | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  lastLoginAt: Date | null;
}

export interface StaffUpdateData {
  email?: string;
  name?: string;
  role?: "GLOBAL_ADMIN" | "TENANT_ADMIN" | "STAFF";
  isActive?: boolean;
}

export interface StaffDeletionResult {
  success: boolean;
  deletedUser: {
    id: string;
    email: string;
    name: string;
    role: "GLOBAL_ADMIN" | "TENANT_ADMIN" | "STAFF";
  };
  deletedPasskeysCount: number;
  deletedKeySharesCount: number;
}

export interface StaffPublicKeyResponse {
  userId: string;
  publicKey: string;
}

export class StaffService {
  /**
   * Get all staff members for a tenant
   */
  static async getStaffMembers(tenantId: string): Promise<StaffMember[]> {
    logger.debug("Fetching staff members", { tenantId });

    try {
      let staff: StaffMember[] = await centralDb
        .select({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          confirmationState: user.confirmationState,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLoginAt: user.lastLoginAt,
        })
        .from(user)
        .where(eq(user.tenantId, tenantId));

      const invitedStaff = await centralDb
        .select({
          id: userInvite.id,
          email: userInvite.email,
          name: userInvite.name,
          role: userInvite.role,
          createdAt: userInvite.createdAt,
        })
        .from(userInvite)
        .where(and(eq(userInvite.tenantId, tenantId), eq(userInvite.used, false)));

      staff = staff.concat(
        invitedStaff.map((invite) => ({
          id: invite.id,
          email: invite.email,
          name: invite.name,
          role: invite.role,
          isActive: null,
          confirmationState: "INVITED" as const,
          createdAt: invite.createdAt,
          updatedAt: null,
          lastLoginAt: null,
        })),
      );

      logger.debug("Staff members fetched successfully", {
        tenantId,
        count: staff.length,
      });

      return staff.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      logger.error("Failed to fetch staff members", {
        tenantId,
        error: String(error),
      });
      throw new InternalError("Failed to fetch staff members");
    }
  }

  /**
   * Update a staff member
   */
  static async updateStaffMember(
    tenantId: string,
    userId: string,
    updateData: StaffUpdateData,
    currentUserId?: string,
  ): Promise<StaffMember> {
    logger.debug("Updating staff member", {
      tenantId,
      userId,
      updateFields: Object.keys(updateData),
      currentUserId,
    });

    // Prevent self-deactivation
    if (updateData.isActive === false && currentUserId === userId) {
      throw new ValidationError("You cannot deactivate your own account");
    }

    try {
      const updatedUser = await centralDb
        .update(user)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(and(eq(user.id, userId), eq(user.tenantId, tenantId)))
        .returning({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          confirmationState: user.confirmationState,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLoginAt: user.lastLoginAt,
        });

      if (updatedUser.length === 0) {
        logger.warn("Staff member not found for update", { tenantId, userId });
        throw new NotFoundError("Staff member not found in this tenant");
      }

      logger.debug("Staff member updated successfully", {
        tenantId,
        userId,
        updateFields: Object.keys(updateData),
      });

      return updatedUser[0];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }

      logger.error("Failed to update staff member", {
        tenantId,
        userId,
        error: String(error),
      });
      throw new InternalError("Failed to update staff member");
    }
  }

  /**
   * Delete a staff member and all associated data
   */
  static async deleteStaffMember(
    tenantId: string,
    staffId: string,
    currentUserId?: string,
    confirmationState?: "INVITED" | "CONFIRMED" | "ACCESS_GRANTED",
  ): Promise<StaffDeletionResult> {
    logger.debug("Deleting staff member", { tenantId, staffId, currentUserId });

    // Prevent self-deletion
    if (currentUserId === staffId) {
      throw new ValidationError("You cannot delete your own account");
    }

    try {
      // Use transaction to ensure all related data is deleted consistently
      const result = await centralDb.transaction(async (tx) => {
        // First, verify the user exists and belongs to this tenant
        if (confirmationState !== "INVITED") {
          const userToDelete = await tx
            .select({
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              tenantId: user.tenantId,
            })
            .from(user)
            .where(and(eq(user.id, staffId), eq(user.tenantId, tenantId)))
            .limit(1);

          if (userToDelete.length === 0) {
            throw new NotFoundError("Staff member not found in this tenant");
          }

          // Delete associated passkeys from central database
          const passkeyDeletionResult = await tx
            .delete(userPasskey)
            .where(eq(userPasskey.userId, staffId));

          const deletedPasskeysCount = passkeyDeletionResult.count || 0;

          logger.debug("Deleted user passkeys", {
            staffId,
            tenantId,
            deletedCount: deletedPasskeysCount,
          });

          // Delete client tunnel key shares from tenant database
          let deletedKeySharesCount = 0;
          try {
            const tenantDb = await getTenantDb(tenantId);
            const keyShareDeletionResult = await tenantDb
              .delete(clientTunnelStaffKeyShare)
              .where(eq(clientTunnelStaffKeyShare.userId, staffId));

            deletedKeySharesCount = keyShareDeletionResult.count || 0;

            logger.debug("Deleted client tunnel key shares", {
              staffId,
              tenantId,
              deletedCount: deletedKeySharesCount,
            });
          } catch (error) {
            logger.warn("Failed to delete client tunnel key shares", {
              staffId,
              tenantId,
              error: String(error),
            });
            // Continue with user deletion even if key share deletion fails
          }
          // Remove old invites of user
          const deletedInvites = await tx
            .delete(userInvite)
            .where(eq(userInvite.email, userToDelete[0].email));
          logger.debug("Deleted user invites", {
            staffId,
            tenantId,
            deletedCount: deletedInvites.count || 0,
          });
          // Finally, delete the user account from central database
          const deletedUsers = await tx.delete(user).where(eq(user.id, staffId)).returning({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          });

          if (deletedUsers.length === 0) {
            throw new InternalError("Failed to delete user account");
          }

          const deletionResult = {
            success: true,
            deletedUser: deletedUsers[0],
            deletedPasskeysCount,
            deletedKeySharesCount,
          };

          logger.info("Staff member deleted successfully", {
            staffId,
            tenantId,
            deletedUser: deletedUsers[0],
            deletedPasskeysCount,
            deletedKeySharesCount,
          });

          return deletionResult;
        } else {
          const deletedInvites = await tx.delete(userInvite).where(eq(userInvite.id, staffId));
          logger.debug("Deleted user invites", {
            staffId,
            tenantId,
            deletedCount: deletedInvites.count || 0,
          });

          const deletionResult = {
            success: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            deletedUser: staffId as any,
            deletedPasskeysCount: 0,
            deletedKeySharesCount: 0,
          };

          logger.info("Staff member invites deleted successfully", {
            staffId,
            tenantId,
            deletedUser: staffId,
          });

          return deletionResult;
        }
      });

      return result;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      logger.error("Failed to delete staff member", {
        tenantId,
        staffId,
        error: String(error),
      });
      throw new InternalError("Failed to delete staff member");
    }
  }

  /**
   * Get a staff member's public key
   */
  static async getStaffPublicKey(
    tenantId: string,
    staffId: string,
  ): Promise<StaffPublicKeyResponse> {
    logger.debug("Fetching staff public key", { tenantId, staffId });

    try {
      // Check if the requested staff user belongs to the tenant
      const staffUser = await centralDb
        .select({
          id: user.id,
          tenantId: user.tenantId,
          isActive: user.isActive,
        })
        .from(user)
        .where(eq(user.id, staffId))
        .limit(1);

      if (staffUser.length === 0) {
        logger.warn("Staff user not found", { tenantId, staffId });
        throw new NotFoundError("Staff user not found");
      }

      if (staffUser[0].tenantId !== tenantId) {
        logger.warn("Staff user does not belong to tenant", {
          tenantId,
          staffId,
          staffTenantId: staffUser[0].tenantId,
        });
        throw new ValidationError("Staff user does not belong to this tenant");
      }

      if (!staffUser[0].isActive) {
        logger.warn("Staff user is inactive", { tenantId, staffId });
        throw new ValidationError("Staff user is inactive");
      }

      const staffCryptoService = new StaffCryptoService();
      const publicKey = await staffCryptoService.getStaffPublicKey(tenantId, staffId);

      if (!publicKey) {
        logger.warn("Staff public key not found", { tenantId, staffId });
        throw new NotFoundError("Staff public key not found");
      }

      logger.debug("Staff public key retrieved successfully", {
        tenantId,
        staffId,
        hasPublicKey: !!publicKey,
      });

      return {
        userId: staffId,
        publicKey: publicKey,
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }

      logger.error("Failed to fetch staff public key", {
        tenantId,
        staffId,
        error: String(error),
      });
      throw new InternalError("Failed to fetch staff public key");
    }
  }

  /**
   * Validate that a staff member exists and belongs to the tenant
   */
  static async validateStaffMember(tenantId: string, staffId: string): Promise<SelectUser> {
    logger.debug("Validating staff member", { tenantId, staffId });

    try {
      const staffUser = await centralDb
        .select()
        .from(user)
        .where(and(eq(user.id, staffId), eq(user.tenantId, tenantId)))
        .limit(1);

      if (staffUser.length === 0) {
        logger.warn("Staff member not found in tenant", { tenantId, staffId });
        throw new NotFoundError("Staff member not found in this tenant");
      }

      logger.debug("Staff member validated successfully", {
        tenantId,
        staffId,
        isActive: staffUser[0].isActive,
      });

      return staffUser[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error("Failed to validate staff member", {
        tenantId,
        staffId,
        error: String(error),
      });
      throw new InternalError("Failed to validate staff member");
    }
  }
}

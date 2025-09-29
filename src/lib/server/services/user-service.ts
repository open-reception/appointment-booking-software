import { centralDb } from "../db";
import * as centralSchema from "../db/central-schema";
import { eq, desc, gt, and, count } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";
import z from "zod/v4";
import { NotFoundError, ValidationError } from "../utils/errors";
import { uuidv7 } from "uuidv7";
import { addMinutes } from "date-fns";
import logger from "$lib/logger";
import {
  generateRecoveryPassphrase,
  hashPassphrase,
  validatePassphraseStrength,
} from "../utils/passphrase";
import { sendConfirmationEmail } from "../email/email-service";
import type { SelectTenant } from "../db/central-schema";
import { TenantAdminService } from "./tenant-admin-service";

export type InsertUser = InferInsertModel<typeof centralSchema.user>;
export type InsertUserPasskey = InferInsertModel<typeof centralSchema.userPasskey>;

const userCreationSchema = z.object({
  name: z.string().min(5),
  email: z.email(),
  role: z.enum(["GLOBAL_ADMIN", "TENANT_ADMIN", "STAFF"]).optional(),
  tenantId: z.string().uuid().optional(),
  passphrase: z.string().min(12).optional(),
  token: z.uuidv7().optional(),
  tokenValidUntil: z.date().optional(),
  language: z.enum(["de", "en"]).optional().default("de"),
});

type UserCreation = z.infer<typeof userCreationSchema>;

/**
 * Create a system tenant object for confirmation emails
 * Since central users don't belong to a specific tenant, we use generic branding
 */
function createSystemTenant(): SelectTenant {
  return {
    id: "system",
    shortName: "open-reception",
    longName: "Open Reception",
    descriptions: { en: "Secure appointment booking platform" },
    languages: ["en"],
    logo: null,
    databaseUrl: "",
    setupState: "FIRST_CHANNEL_CREATED",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Get tenant data for a user, fallback to system tenant if no tenant assigned
 */
async function getTenantForUser(user: { tenantId?: string | null }): Promise<SelectTenant> {
  if (!user.tenantId) {
    return createSystemTenant();
  }

  try {
    const tenantService = await TenantAdminService.getTenantById(user.tenantId);
    return tenantService.tenantData || createSystemTenant();
  } catch {
    // If tenant not found, use system tenant as fallback
    return createSystemTenant();
  }
}

export class UserService {
  /**
   * Create a new user
   */
  static async createUser(userData: UserCreation, requestUrl?: URL) {
    const log = logger.setContext("UserService");
    log.debug("Creating new user account", {
      email: userData.email,
      name: userData.name,
      role: userData.role,
      hasPassphrase: !!userData.passphrase,
    });

    const validated = userCreationSchema.safeParse(userData);
    if (!validated.success) {
      log.warn("User creation failed: Invalid data", {
        email: userData.email,
        errors: validated.error,
      });
      throw new ValidationError("Invalid user data");
    }

    // Validate passphrase strength if provided
    if (userData.passphrase && !validatePassphraseStrength(userData.passphrase)) {
      throw new ValidationError("Passphrase must be at least 12 characters long");
    }

    userData.token = uuidv7();
    userData.tokenValidUntil = addMinutes(new Date(), 10);

    // Prepare user data for database
    const userDataForDb: InsertUser = {
      name: userData.name,
      email: userData.email,
      role: userData.role,
      tenantId: userData.tenantId,
      token: userData.token,
      tokenValidUntil: userData.tokenValidUntil,
      language: userData.language || "de",
      confirmed: false,
      isActive: false,
    };

    // Handle passphrase or generate recovery passphrase
    if (userData.passphrase) {
      // User provided a passphrase, hash it
      userDataForDb.passphraseHash = await hashPassphrase(userData.passphrase);
    } else if (userData.role === "GLOBAL_ADMIN") {
      // No passphrase provided, generate a recovery passphrase
      userDataForDb.recoveryPassphrase = generateRecoveryPassphrase();
    }

    try {
      const result = await centralDb.insert(centralSchema.user).values(userDataForDb).returning();

      log.debug("User account created successfully", {
        userId: result[0].id,
        email: result[0].email,
        tokenValidUntil: result[0].tokenValidUntil,
        hasPassphrase: !!result[0].passphraseHash,
        hasRecoveryPassphrase: !!result[0].recoveryPassphrase,
      });

      // Send confirmation email to user (token is used as confirmation code)
      try {
        if (result[0].email && result[0].token) {
          const tenant = await getTenantForUser(result[0]);
          await sendConfirmationEmail(
            result[0],
            tenant,
            result[0].token,
            10, // 10 minutes expiration to match tokenValidUntil
            requestUrl,
          );
          log.debug("Confirmation email sent successfully", {
            userId: result[0].id,
            email: result[0].email,
            tenantId: result[0].tenantId,
          });
        }
      } catch (emailError) {
        log.warn("Failed to send confirmation email", {
          userId: result[0].id,
          email: result[0].email,
          error: String(emailError),
        });
        // Don't throw - user creation succeeded, email is just a bonus
      }

      return result[0];
    } catch (error) {
      log.error("Failed to create user account", { email: userData.email, error: String(error) });
      throw error;
    }
  }

  /**
   * Resend the confirmation email for a user
   * @param email - Email of the user to confirm
   * @param requestUrl - Optional request URL for generating correct baseUrl
   */
  static async resendConfirmationEmail(email: string, requestUrl?: URL): Promise<void> {
    const log = logger.setContext("UserService");
    log.debug("Resending confirmation email", { email });

    const token = uuidv7();
    const tokenValidUntil = addMinutes(new Date(), 10);

    try {
      const result = await centralDb
        .update(centralSchema.user)
        .set({ token, tokenValidUntil })
        .where(eq(centralSchema.user.email, email))
        .returning();

      if (result.length !== 1) {
        log.warn("Failed to resend confirmation email: User not found", { email });
        throw new NotFoundError(`Could not resend confirmation mail for unknown user ${email}`);
      }

      const user = result[0];
      log.debug("Confirmation email resent successfully", { email, tokenValidUntil });

      // Send confirmation email with new token - use tenant-specific branding if available
      try {
        const tenant = await getTenantForUser(user);
        await sendConfirmationEmail(
          user,
          tenant,
          token,
          10, // 10 minutes expiration to match tokenValidUntil
          requestUrl,
        );
        log.debug("Confirmation email sent successfully", {
          userId: user.id,
          email: user.email,
          tenantId: user.tenantId,
        });
      } catch (emailError) {
        log.error("Failed to send confirmation email", {
          userId: user.id,
          email: user.email,
          error: String(emailError),
        });
        throw emailError; // In this case, we do want to propagate the error
      }
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      log.error("Failed to resend confirmation email", { email, error: String(error) });
      throw error;
    }
  }

  /**
   * Confirm and activate user after confirmation link was clicked
   * @param linkToken - The token from the link
   */
  static async confirm(
    linkToken: string,
  ): Promise<{ recoveryPassphrase?: string; isSetup: boolean }> {
    const log = logger.setContext("UserService");
    log.debug("Confirming user account", { token: linkToken.substring(0, 8) + "..." });

    try {
      // First, get the user data to check for recovery passphrase
      const userData = await centralDb
        .select({
          id: centralSchema.user.id,
          recoveryPassphrase: centralSchema.user.recoveryPassphrase,
        })
        .from(centralSchema.user)
        .where(
          and(
            eq(centralSchema.user.token, linkToken),
            gt(centralSchema.user.tokenValidUntil, new Date()),
          ),
        )
        .limit(1);

      if (userData.length === 0) {
        log.warn("User confirmation failed: Invalid or expired token", {
          token: linkToken.substring(0, 8) + "...",
        });
        throw new NotFoundError("Invalid or timed-out token");
      }

      const user = userData[0];

      // Update the user to confirmed and active, and clear the recovery passphrase
      const result = await centralDb
        .update(centralSchema.user)
        .set({
          confirmed: true,
          isActive: true,
          recoveryPassphrase: null, // Clear it after showing it once
        })
        .where(eq(centralSchema.user.id, user.id))
        .execute();

      if (result.count != 1) {
        throw new NotFoundError("Failed to confirm user");
      }

      const countResult = await centralDb.select({ count: count() }).from(centralSchema.user);

      log.debug("User account confirmed successfully", {
        userId: user.id,
        token: linkToken.substring(0, 8) + "...",
        hadRecoveryPassphrase: !!user.recoveryPassphrase,
      });

      return {
        recoveryPassphrase: user.recoveryPassphrase || undefined,
        isSetup: countResult[0].count === 1,
      };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      log.error("Failed to confirm user account", {
        token: linkToken.substring(0, 8) + "...",
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Add additional WebAuthn passkey to existing user
   */
  static async addAdditionalPasskey(userId: string, passkeyData: InsertUserPasskey): Promise<void> {
    const log = logger.setContext("UserService");
    log.debug("Adding additional passkey to user", { userId, passkeyId: passkeyData.id });

    try {
      // Check if user exists and is active
      const user = await centralDb
        .select({ id: centralSchema.user.id, confirmed: centralSchema.user.confirmed })
        .from(centralSchema.user)
        .where(eq(centralSchema.user.id, userId))
        .limit(1);

      if (user.length === 0) {
        throw new NotFoundError("User not found");
      }

      if (!user[0].confirmed) {
        throw new ValidationError(
          "User account must be confirmed before adding additional passkeys",
        );
      }

      // Add the passkey
      await centralDb.insert(centralSchema.userPasskey).values({
        ...passkeyData,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      log.debug("Additional passkey added successfully", { userId, passkeyId: passkeyData.id });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
      log.error("Failed to add additional passkey", { userId, error: String(error) });
      throw error;
    }
  }

  /**
   * Get admin by email
   */
  static async getUserByEmail(email: string) {
    const log = logger.setContext("UserService");
    log.debug("Getting admin by email", { email });

    try {
      const result = await centralDb
        .select()
        .from(centralSchema.user)
        .where(eq(centralSchema.user.email, email))
        .limit(1);

      if (!result[0]) {
        log.warn("User not found by email", { email });
        throw new NotFoundError(`No user account for ${email}.`);
      }

      log.debug("User found by email", {
        email,
        userId: result[0].id,
        confirmed: result[0].confirmed,
      });
      return result[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      log.error("Failed to get user by email", { email, error: String(error) });
      throw error;
    }
  }

  /**
   * Get all admins
   */
  static async getAllAdmins() {
    const log = logger.setContext("UserService");
    log.debug("Getting all admins");

    try {
      const result = await centralDb
        .select()
        .from(centralSchema.user)
        .orderBy(desc(centralSchema.user.createdAt))
        .where(eq(centralSchema.user.role, "GLOBAL_ADMIN"));

      log.debug("Retrieved all admins", { count: result.length });
      return result;
    } catch (error) {
      log.error("Failed to get all admins", { error: String(error) });
      throw error;
    }
  }

  /**
   * Get all admins
   */
  static async getAllUsers() {
    const log = logger.setContext("UserService");
    log.debug("Getting all users");

    try {
      const result = await centralDb
        .select()
        .from(centralSchema.user)
        .orderBy(desc(centralSchema.user.createdAt));

      log.debug("Retrieved all users", { count: result.length });
      return result;
    } catch (error) {
      log.error("Failed to get all users", { error: String(error) });
      throw error;
    }
  }

  /**
   * Update a user's data
   */
  static async updateUser(
    userId: string,
    updateData: Partial<Omit<InsertUser, "id" | "createdAt">>,
  ) {
    const log = logger.setContext("UserService");
    log.debug("Updating user", { userId, updateFields: Object.keys(updateData) });

    try {
      const result = await centralDb
        .update(centralSchema.user)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(centralSchema.user.id, userId))
        .returning();

      if (result[0]) {
        log.debug("User updated successfully", { userId, updateFields: Object.keys(updateData) });
      } else {
        log.warn("User update failed: User not found", { userId });
      }

      return result[0] || null;
    } catch (error) {
      log.error("Failed to update user", { userId, error: String(error) });
      throw error;
    }
  }

  /**
   * Permanently delete admin and all associated passkeys
   */
  static async deleteUser(userId: string) {
    const log = logger.setContext("UserService");
    log.debug("Deleting user and associated passkeys", { userId });

    try {
      // Delete associated passkeys first
      const passkeyResult = await centralDb
        .delete(centralSchema.userPasskey)
        .where(eq(centralSchema.userPasskey.userId, userId));

      log.debug("Deleted user passkeys", { userId, deletedCount: passkeyResult.count || 0 });

      // Delete admin
      const result = await centralDb
        .delete(centralSchema.user)
        .where(eq(centralSchema.user.id, userId))
        .returning();

      if (result[0]) {
        log.debug("User deleted successfully", { userId, email: result[0].email });
      } else {
        log.warn("User deletion failed: User not found", { userId });
      }

      return result[0] || null;
    } catch (error) {
      log.error("Failed to delete user", { userId, error: String(error) });
      throw error;
    }
  }

  /**
   * Update last login timestamp
   */
  static async updateLastLogin(userId: string) {
    const log = logger.setContext("UserService");
    log.debug("Updating last login timestamp", { userId });

    return await this.updateUser(userId, { lastLoginAt: new Date() });
  }

  /**
   * Add a passkey for a uaer
   */
  static async addPasskey(
    userId: string,
    passkeyData: Omit<InsertUserPasskey, "userId" | "createdAt" | "updatedAt">,
  ) {
    const log = logger.setContext("UserService");
    log.debug("Adding passkey for user", {
      userId,
      passkeyId: passkeyData.id,
      deviceName: passkeyData.deviceName,
    });

    try {
      const result = await centralDb
        .insert(centralSchema.userPasskey)
        .values({
          ...passkeyData,
          userId,
        })
        .returning();

      log.debug("Passkey added successfully", {
        userId,
        passkeyId: result[0].id,
        deviceName: result[0].deviceName,
      });
      return result[0];
    } catch (error) {
      log.error("Failed to add passkey", {
        userId,
        passkeyId: passkeyData.id,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get all passkeys for an admin
   */
  static async getUserPasskeys(userId: string) {
    return await centralDb
      .select()
      .from(centralSchema.userPasskey)
      .where(eq(centralSchema.userPasskey.userId, userId))
      .orderBy(desc(centralSchema.userPasskey.createdAt));
  }

  /**
   * Update passkey (e.g., counter, last used time)
   */
  static async updatePasskey(
    passkeyId: string,
    updateData: Partial<Omit<InsertUserPasskey, "id" | "userId" | "createdAt">>,
  ) {
    const result = await centralDb
      .update(centralSchema.userPasskey)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(centralSchema.userPasskey.id, passkeyId))
      .returning();

    return result[0] || null;
  }

  /**
   * Delete a passkey
   */
  static async deletePasskey(passkeyId: string) {
    const result = await centralDb
      .delete(centralSchema.userPasskey)
      .where(eq(centralSchema.userPasskey.id, passkeyId))
      .returning();

    return result[0] || null;
  }

  /**
   * Update passkey last used timestamp and counter
   */
  static async updatePasskeyUsage(passkeyId: string, newCounter: number) {
    const log = logger.setContext("UserService");
    log.debug("Updating passkey usage", { passkeyId, newCounter });

    return await this.updatePasskey(passkeyId, {
      counter: newCounter,
      lastUsedAt: new Date(),
    });
  }

  /**
   * Check if any admin exists in the system
   */
  static async adminExists(): Promise<boolean> {
    const log = logger.setContext("UserService");
    log.debug("Checking if any admin exists");

    try {
      const result = await centralDb
        .select({ id: centralSchema.user.id })
        .from(centralSchema.user)
        .where(eq(centralSchema.user.role, "GLOBAL_ADMIN"))
        .limit(1);

      const exists = result.length > 0;
      log.debug("Admin existence check completed", { exists });
      return exists;
    } catch (error) {
      log.error("Failed to check admin existence", { error: String(error) });
      throw error;
    }
  }

  /**
   * Get total count of admins in the system
   */
  static async getAdminCount(): Promise<number> {
    const log = logger.setContext("UserService");
    log.debug("Getting admin count");

    try {
      const result = await centralDb
        .select()
        .from(centralSchema.user)
        .where(eq(centralSchema.user.role, "GLOBAL_ADMIN"));

      const count = result.length;
      log.debug("Admin count retrieved", { count });
      return count;
    } catch (error) {
      log.error("Failed to get admin count", { error: String(error) });
      throw error;
    }
  }
}

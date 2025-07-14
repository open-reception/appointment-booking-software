import { centralDb } from "../db";
import * as centralSchema from "../db/central-schema";
import { eq, desc, gt, and } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";
import z from "zod/v4";
import { NotFoundError, ValidationError } from "../utils/errors";
import { uuidv7 } from "uuidv7";
import { addMinutes } from "date-fns";
import logger from "$lib/logger";

export type InsertAdmin = InferInsertModel<typeof centralSchema.admin>;
export type InsertAdminPasskey = InferInsertModel<typeof centralSchema.adminPasskey>;

const adminCreationSchema = z.object({
	name: z.string().min(5),
	email: z.email(),
	token: z.uuidv7().optional(),
	tokenValidUntil: z.date().optional()
});

type AdminCreation = z.infer<typeof adminCreationSchema>;

export class AdminAccountService {
	/**
	 * Create a new admin user
	 */
	static async createAdmin(adminData: AdminCreation) {
		const log = logger.setContext("AdminAccountService");
		log.debug("Creating new admin account", { email: adminData.email, name: adminData.name });

		const validated = adminCreationSchema.safeParse(adminData);
		if (!validated.success) {
			log.warn("Admin creation failed: Invalid data", {
				email: adminData.email,
				errors: validated.error
			});
			throw new ValidationError("Invalid admin data");
		}

		adminData.token = uuidv7();
		adminData.tokenValidUntil = addMinutes(new Date(), 10);

		try {
			const result = await centralDb
				.insert(centralSchema.admin)
				.values({ ...adminData, confirmed: false, isActive: false })
				.returning();

			log.debug("Admin account created successfully", {
				adminId: result[0].id,
				email: result[0].email,
				tokenValidUntil: result[0].tokenValidUntil
			});

			// TODO: Send confirmation email to admin (Link contains the above token)
			return result[0];
		} catch (error) {
			log.error("Failed to create admin account", { email: adminData.email, error: String(error) });
			throw error;
		}
	}

	/**
	 * Resend the confirmation email for an admin
	 * @param email - Email of the admin to confirm
	 */
	static async resendConfirmationEmail(email: string): Promise<void> {
		const log = logger.setContext("AdminAccountService");
		log.debug("Resending confirmation email", { email });

		const token = uuidv7();
		const tokenValidUntil = addMinutes(new Date(), 10);

		try {
			const result = await centralDb
				.update(centralSchema.admin)
				.set({ token, tokenValidUntil })
				.execute();

			if (result.count != 1) {
				log.warn("Failed to resend confirmation email: Admin not found", { email });
				throw new NotFoundError(`Could not resend confirmation mail for unknown admin ${email}`);
			}

			log.debug("Confirmation email resent successfully", { email, tokenValidUntil });
			// TODO: Send confirmation email
		} catch (error) {
			if (error instanceof NotFoundError) throw error;
			log.error("Failed to resend confirmation email", { email, error: String(error) });
			throw error;
		}
	}

	/**
	 * Confirm and active admin after confirmation link was clicked
	 * @param linkToken - The token from the link
	 */
	static async confirm(linkToken: string): Promise<void> {
		const log = logger.setContext("AdminAccountService");
		log.debug("Confirming admin account", { token: linkToken.substring(0, 8) + "..." });

		try {
			const result = await centralDb
				.update(centralSchema.admin)
				.set({ confirmed: true, isActive: true })
				.where(
					and(
						eq(centralSchema.admin.token, linkToken),
						gt(centralSchema.admin.tokenValidUntil, new Date())
					)
				)
				.execute();

			if (result.count != 1) {
				log.warn("Admin confirmation failed: Invalid or expired token", {
					token: linkToken.substring(0, 8) + "..."
				});
				throw new NotFoundError("Invalid or timed-out token");
			}

			log.debug("Admin account confirmed successfully", {
				token: linkToken.substring(0, 8) + "..."
			});
		} catch (error) {
			if (error instanceof NotFoundError) throw error;
			log.error("Failed to confirm admin account", {
				token: linkToken.substring(0, 8) + "...",
				error: String(error)
			});
			throw error;
		}
	}

	/**
	 * Get admin by email
	 */
	static async getAdminByEmail(email: string) {
		const log = logger.setContext("AdminAccountService");
		log.debug("Getting admin by email", { email });

		try {
			const result = await centralDb
				.select()
				.from(centralSchema.admin)
				.where(eq(centralSchema.admin.email, email))
				.limit(1);

			if (!result[0]) {
				log.warn("Admin not found by email", { email });
				throw new NotFoundError(`No admin account for ${email}.`);
			}

			log.debug("Admin found by email", {
				email,
				adminId: result[0].id,
				confirmed: result[0].confirmed
			});
			return result[0];
		} catch (error) {
			if (error instanceof NotFoundError) throw error;
			log.error("Failed to get admin by email", { email, error: String(error) });
			throw error;
		}
	}

	/**
	 * Get all admins
	 */
	static async getAllAdmins() {
		const log = logger.setContext("AdminAccountService");
		log.debug("Getting all admins");

		try {
			const result = await centralDb
				.select()
				.from(centralSchema.admin)
				.orderBy(desc(centralSchema.admin.createdAt));

			log.debug("Retrieved all admins", { count: result.length });
			return result;
		} catch (error) {
			log.error("Failed to get all admins", { error: String(error) });
			throw error;
		}
	}

	/**
	 * Update admin data
	 */
	static async updateAdmin(
		adminId: string,
		updateData: Partial<Omit<InsertAdmin, "id" | "createdAt">>
	) {
		const log = logger.setContext("AdminAccountService");
		log.debug("Updating admin", { adminId, updateFields: Object.keys(updateData) });

		try {
			const result = await centralDb
				.update(centralSchema.admin)
				.set({
					...updateData,
					updatedAt: new Date()
				})
				.where(eq(centralSchema.admin.id, adminId))
				.returning();

			if (result[0]) {
				log.debug("Admin updated successfully", { adminId, updateFields: Object.keys(updateData) });
			} else {
				log.warn("Admin update failed: Admin not found", { adminId });
			}

			return result[0] || null;
		} catch (error) {
			log.error("Failed to update admin", { adminId, error: String(error) });
			throw error;
		}
	}

	/**
	 * Permanently delete admin and all associated passkeys
	 */
	static async deleteAdmin(adminId: string) {
		const log = logger.setContext("AdminAccountService");
		log.debug("Deleting admin and associated passkeys", { adminId });

		try {
			// Delete associated passkeys first
			const passkeyResult = await centralDb
				.delete(centralSchema.adminPasskey)
				.where(eq(centralSchema.adminPasskey.adminId, adminId));

			log.debug("Deleted admin passkeys", { adminId, deletedCount: passkeyResult.count || 0 });

			// Delete admin
			const result = await centralDb
				.delete(centralSchema.admin)
				.where(eq(centralSchema.admin.id, adminId))
				.returning();

			if (result[0]) {
				log.debug("Admin deleted successfully", { adminId, email: result[0].email });
			} else {
				log.warn("Admin deletion failed: Admin not found", { adminId });
			}

			return result[0] || null;
		} catch (error) {
			log.error("Failed to delete admin", { adminId, error: String(error) });
			throw error;
		}
	}

	/**
	 * Update last login timestamp
	 */
	static async updateLastLogin(adminId: string) {
		const log = logger.setContext("AdminAccountService");
		log.debug("Updating last login timestamp", { adminId });

		return await this.updateAdmin(adminId, { lastLoginAt: new Date() });
	}

	/**
	 * Add a passkey for an admin
	 */
	static async addPasskey(
		adminId: string,
		passkeyData: Omit<InsertAdminPasskey, "adminId" | "createdAt" | "updatedAt">
	) {
		const log = logger.setContext("AdminAccountService");
		log.debug("Adding passkey for admin", {
			adminId,
			passkeyId: passkeyData.id,
			deviceName: passkeyData.deviceName
		});

		try {
			const result = await centralDb
				.insert(centralSchema.adminPasskey)
				.values({
					...passkeyData,
					adminId
				})
				.returning();

			log.debug("Passkey added successfully", {
				adminId,
				passkeyId: result[0].id,
				deviceName: result[0].deviceName
			});
			return result[0];
		} catch (error) {
			log.error("Failed to add passkey", {
				adminId,
				passkeyId: passkeyData.id,
				error: String(error)
			});
			throw error;
		}
	}

	/**
	 * Get all passkeys for an admin
	 */
	static async getAdminPasskeys(adminId: string) {
		return await centralDb
			.select()
			.from(centralSchema.adminPasskey)
			.where(eq(centralSchema.adminPasskey.adminId, adminId))
			.orderBy(desc(centralSchema.adminPasskey.createdAt));
	}

	/**
	 * Update passkey (e.g., counter, last used time)
	 */
	static async updatePasskey(
		passkeyId: string,
		updateData: Partial<Omit<InsertAdminPasskey, "id" | "adminId" | "createdAt">>
	) {
		const result = await centralDb
			.update(centralSchema.adminPasskey)
			.set({
				...updateData,
				updatedAt: new Date()
			})
			.where(eq(centralSchema.adminPasskey.id, passkeyId))
			.returning();

		return result[0] || null;
	}

	/**
	 * Delete a passkey
	 */
	static async deletePasskey(passkeyId: string) {
		const result = await centralDb
			.delete(centralSchema.adminPasskey)
			.where(eq(centralSchema.adminPasskey.id, passkeyId))
			.returning();

		return result[0] || null;
	}

	/**
	 * Update passkey last used timestamp and counter
	 */
	static async updatePasskeyUsage(passkeyId: string, newCounter: number) {
		const log = logger.setContext("AdminAccountService");
		log.debug("Updating passkey usage", { passkeyId, newCounter });

		return await this.updatePasskey(passkeyId, {
			counter: newCounter,
			lastUsedAt: new Date()
		});
	}

	/**
	 * Check if any admin exists in the system
	 */
	static async adminExists(): Promise<boolean> {
		const log = logger.setContext("AdminAccountService");
		log.debug("Checking if any admin exists");

		try {
			const result = await centralDb
				.select({ id: centralSchema.admin.id })
				.from(centralSchema.admin)
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
		const log = logger.setContext("AdminAccountService");
		log.debug("Getting admin count");

		try {
			const result = await centralDb
				.select()
				.from(centralSchema.admin);

			const count = result.length;
			log.debug("Admin count retrieved", { count });
			return count;
		} catch (error) {
			log.error("Failed to get admin count", { error: String(error) });
			throw error;
		}
	}
}

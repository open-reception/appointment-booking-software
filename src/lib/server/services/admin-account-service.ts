import { centralDb } from "../db";
import * as centralSchema from "../db/central-schema";
import { eq, desc, gt, and } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";
import z from "zod/v4";
import { NotFoundError, ValidationError } from "../utils/errors";
import { uuidv7 } from "uuidv7";
import { addMinutes } from "date-fns";

export type InsertAdmin = InferInsertModel<typeof centralSchema.admin>;
export type InsertAdminPasskey = InferInsertModel<typeof centralSchema.adminPasskey>;

const adminCreationSchema = z.object({
	name: z.string().min(5),
	email: z.string().email(),
	token: z.uuidv7().optional(),
	tokenValidUntil: z.date().optional()
});

type AdminCreation = z.infer<typeof adminCreationSchema>;

export class AdminAccountService {
	/**
	 * Create a new admin user
	 */
	static async createAdmin(adminData: AdminCreation) {
		const validated = adminCreationSchema.safeParse(adminData);
		if (!validated.success) throw new ValidationError("Invalid admin data");
		adminData.token = uuidv7();
		adminData.tokenValidUntil = addMinutes(new Date(), 10);
		const result = await centralDb
			.insert(centralSchema.admin)
			.values({ ...adminData, confirmed: false, isActive: false })
			.returning();
		// TODO: Send confirmation email to admin (Link contains the above token)
		return result[0];
	}

	/**
	 * Resend the confirmation email for an admin
	 * @param email - Email of the admin to confirm
	 */
	static async resendConfirmationEmail(email: string): Promise<void> {
		const token = uuidv7();
		const tokenValidUntil = addMinutes(new Date(), 10);
		const result = await centralDb
			.update(centralSchema.admin)
			.set({ token, tokenValidUntil })
			.execute();
		if (result.count != 1) {
			throw new NotFoundError(`Could not resend confirmation mail for unknown admin ${email}`);
		}
		// TODO: Send confirmation email
	}

	/**
	 * Confirm and active admin after confirmation link was clicked
	 * @param linkToken - The token from the link
	 */
	static async confirm(linkToken: string): Promise<void> {
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
			throw new NotFoundError("Invalid or timed-out token");
		}
	}

	/**
	 * Get admin by email
	 */
	static async getAdminByEmail(email: string) {
		const result = await centralDb
			.select()
			.from(centralSchema.admin)
			.where(eq(centralSchema.admin.email, email))
			.limit(1);
		if (!result[0]) {
			throw new NotFoundError(`No admin account for ${email}.`);
		}

		return result[0];
	}

	/**
	 * Get all admins
	 */
	static async getAllAdmins() {
		return await centralDb
			.select()
			.from(centralSchema.admin)
			.orderBy(desc(centralSchema.admin.createdAt));
	}

	/**
	 * Update admin data
	 */
	static async updateAdmin(
		adminId: string,
		updateData: Partial<Omit<InsertAdmin, "id" | "createdAt">>
	) {
		const result = await centralDb
			.update(centralSchema.admin)
			.set({
				...updateData,
				updatedAt: new Date()
			})
			.where(eq(centralSchema.admin.id, adminId))
			.returning();

		return result[0] || null;
	}

	/**
	 * Permanently delete admin and all associated passkeys
	 */
	static async deleteAdmin(adminId: string) {
		// Delete associated passkeys first
		await centralDb
			.delete(centralSchema.adminPasskey)
			.where(eq(centralSchema.adminPasskey.adminId, adminId));

		// Delete admin
		const result = await centralDb
			.delete(centralSchema.admin)
			.where(eq(centralSchema.admin.id, adminId))
			.returning();

		return result[0] || null;
	}

	/**
	 * Update last login timestamp
	 */
	static async updateLastLogin(adminId: string) {
		return await this.updateAdmin(adminId, { lastLoginAt: new Date() });
	}

	/**
	 * Add a passkey for an admin
	 */
	static async addPasskey(
		adminId: string,
		passkeyData: Omit<InsertAdminPasskey, "adminId" | "createdAt" | "updatedAt">
	) {
		const result = await centralDb
			.insert(centralSchema.adminPasskey)
			.values({
				...passkeyData,
				adminId
			})
			.returning();

		return result[0];
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
		return await this.updatePasskey(passkeyId, {
			counter: newCounter,
			lastUsedAt: new Date()
		});
	}
}

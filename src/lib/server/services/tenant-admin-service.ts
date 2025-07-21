import { centralDb, getTenantDb } from "../db";
import * as centralSchema from "../db/central-schema";
import { type InsertTenant } from "../db/central-schema";
import { TenantConfig } from "../db/tenant-config";
import { TenantMigrationService } from "./tenant-migration-service";

import { env } from "$env/dynamic/private";
import { eq } from "drizzle-orm";
import logger from "$lib/logger";
import z from "zod/v4";
import { ValidationError, NotFoundError } from "../utils/errors";

if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

const tentantCreationSchema = z.object({
	shortName: z.string().min(4).max(15),
	inviteAdmin: z.email().optional()
});

export type TenantCreationRequest = z.infer<typeof tentantCreationSchema>;

export interface TenantConfiguration extends Record<string, string | number | boolean> {
	brandColor: string;
	defaultLanguage: string;
	maxChannels: number;
	maxTeamMembers: number;
	autoDeleteDays: number;
	requireEmail: boolean;
	requirePhone: boolean;
	nextChannelColor: number;
	website: string;
	imprint: string;
	privacyStatement: string;
}

export class TenantAdminService {
	#config!: TenantConfig;
	#tenant: Awaited<centralSchema.SelectTenant> | null = null;
	#db: Awaited<ReturnType<typeof getTenantDb>> | null = null;

	private constructor(public readonly tenantId: string) {}

	static getConfigDefaults(): TenantConfiguration {
		return {
			brandColor: "#E11E15",
			defaultLanguage: "DE",
			maxChannels: -1,
			maxTeamMembers: -1,
			autoDeleteDays: 30,
			requireEmail: true,
			requirePhone: false,
			nextChannelColor: 0,
			website: "",
			imprint: "",
			privacyStatement: ""
		};
	}

	static async createTenant(request: TenantCreationRequest) {
		const log = logger.setContext("TenantAdminService");

		const validation = tentantCreationSchema.safeParse(request);

		if (!validation.success) throw new ValidationError("Invalid tenant creation request");

		log.debug("Creating new tenant", {
			shortName: request.shortName
		});

		const configuration = TenantAdminService.getConfigDefaults();

		const urlParts = env.DATABASE_URL.split("/");
		urlParts.pop();

		const newTenant: InsertTenant = { ...request, longName: "", databaseUrl: "" };
		newTenant.databaseUrl = urlParts.join("/") + "/" + newTenant.shortName;

		try {
			const tenant = await centralDb.insert(centralSchema.tenant).values(newTenant).returning();

			log.debug("Tenant created in database", {
				tenantId: tenant[0].id,
				shortName: newTenant.shortName
			});

			// Initialize tenant database with schema
			try {
				await TenantMigrationService.createAndInitializeTenantDatabase(newTenant.databaseUrl);
				log.debug("Tenant database initialized successfully", {
					tenantId: tenant[0].id,
					databaseUrl: newTenant.databaseUrl
				});
			} catch (dbError) {
				log.error("Failed to initialize tenant database", {
					tenantId: tenant[0].id,
					databaseUrl: newTenant.databaseUrl,
					error: String(dbError)
				});

				// Clean up the tenant record if database initialization fails
				await centralDb
					.delete(centralSchema.tenant)
					.where(eq(centralSchema.tenant.id, tenant[0].id));
				throw new Error(`Failed to initialize tenant database: ${String(dbError)}`);
			}

			const config = await TenantConfig.create(tenant[0].id);
			for (const [key, value] of Object.entries(configuration)) {
				config.setConfig(key, value);
			}

			log.debug("Tenant configuration initialized", {
				tenantId: tenant[0].id,
				configCount: Object.keys(configuration).length
			});

			const tenantService = new TenantAdminService(tenant[0].id);
			tenantService.#config = config;
			tenantService.#tenant = tenant[0];

			log.debug("Tenant service created successfully", { tenantId: tenant[0].id });

			// TODO sent tenant admin invitation mail

			return tenantService;
		} catch (error) {
			log.error("Failed to create tenant", {
				shortName: newTenant.shortName,
				error: String(error)
			});
			throw error;
		}
	}

	/**
	 * Create a tenant admin service by its ID
	 * @param id
	 * @returns new TenantAdminService
	 */
	static async getTenantById(id: string) {
		const log = logger.setContext("TenantAdminService");
		log.debug("Getting tenant by ID", { tenantId: id });

		try {
			const tenant = new TenantAdminService(id);
			tenant.#config = await TenantConfig.create(id);
			const data = await tenant.#db
				?.select()
				.from(centralSchema.tenant)
				.where(eq(centralSchema.tenant.id, id))
				.limit(1);
			if (data) {
				tenant.#tenant = data[0];
			}

			log.debug("Tenant service loaded successfully", { tenantId: id });
			return tenant;
		} catch (error) {
			log.error("Failed to get tenant by ID", { tenantId: id, error: String(error) });
			throw error;
		}
	}

	/**
	 * Access the tenants configuration
	 */
	get configuration() {
		return this.#config;
	}

	get tenantData() {
		return this.#tenant;
	}

	/**
	 * Update tenant data (longName, shortName, description, logo)
	 */
	async updateTenantData(
		updateData: Partial<Pick<InsertTenant, "longName" | "shortName" | "description" | "logo">>
	) {
		const log = logger.setContext("TenantAdminService");
		log.debug("Updating tenant data", {
			tenantId: this.tenantId,
			updateFields: Object.keys(updateData)
		});

		try {
			const result = await centralDb
				.update(centralSchema.tenant)
				.set({
					...updateData,
					updatedAt: new Date()
				})
				.where(eq(centralSchema.tenant.id, this.tenantId))
				.returning();

			if (!result[0]) {
				log.warn("Tenant update failed: Tenant not found", { tenantId: this.tenantId });
				throw new NotFoundError(`Tenant with ID ${this.tenantId} not found`);
			}

			log.debug("Tenant data updated successfully", {
				tenantId: this.tenantId,
				updateFields: Object.keys(updateData)
			});

			return result[0];
		} catch (error) {
			if (error instanceof NotFoundError) throw error;
			log.error("Failed to update tenant data", {
				tenantId: this.tenantId,
				error: String(error)
			});
			throw error;
		}
	}

	/**
	 * Update tenant configuration entries using TenantConfig
	 */
	async updateTenantConfig(configUpdates: Record<string, boolean | number | string>) {
		const log = logger.setContext("TenantAdminService");
		log.debug("Updating tenant configuration", {
			tenantId: this.tenantId,
			configKeys: Object.keys(configUpdates)
		});

		try {
			const results = [];

			for (const [key, value] of Object.entries(configUpdates)) {
				await this.#config.setConfig(key, value);
				results.push({ key, value });
			}

			log.debug("Tenant configuration updated successfully", {
				tenantId: this.tenantId,
				configKeys: Object.keys(configUpdates),
				updatedCount: results.length
			});

			return results;
		} catch (error) {
			log.error("Failed to update tenant configuration", {
				tenantId: this.tenantId,
				configKeys: Object.keys(configUpdates),
				error: String(error)
			});
			throw error;
		}
	}

	/**
	 * Set the setup state of the tenant
	 */
	async setSetupState(
		setupState: "NEW" | "SETTINGS_CREATED" | "AGENTS_SET_UP" | "FIRST_CHANNEL_CREATED"
	) {
		const log = logger.setContext("TenantAdminService");
		log.debug("Setting tenant setup state", {
			tenantId: this.tenantId,
			setupState
		});

		try {
			const result = await centralDb
				.update(centralSchema.tenant)
				.set({
					setupState,
					updatedAt: new Date()
				})
				.where(eq(centralSchema.tenant.id, this.tenantId))
				.returning();

			if (!result[0]) {
				log.warn("Tenant setup state update failed: Tenant not found", { tenantId: this.tenantId });
				throw new NotFoundError(`Tenant with ID ${this.tenantId} not found`);
			}

			this.#tenant = result[0];

			log.debug("Tenant setup state updated successfully", {
				tenantId: this.tenantId,
				setupState
			});

			return result[0];
		} catch (error) {
			if (error instanceof NotFoundError) throw error;
			log.error("Failed to set tenant setup state", {
				tenantId: this.tenantId,
				setupState,
				error: String(error)
			});
			throw error;
		}
	}

	/**
	 * Get the tenant's database connection (cached)
	 */
	async getDb() {
		const log = logger.setContext("TenantAdminService");

		if (!this.#db) {
			log.debug("Creating new tenant database connection", { tenantId: this.tenantId });
			try {
				this.#db = await getTenantDb(this.tenantId);
				log.debug("Tenant database connection established", { tenantId: this.tenantId });
			} catch (error) {
				log.error("Failed to establish tenant database connection", {
					tenantId: this.tenantId,
					error: String(error)
				});
				throw error;
			}
		} else {
			log.debug("Using cached tenant database connection", { tenantId: this.tenantId });
		}

		return this.#db;
	}
}

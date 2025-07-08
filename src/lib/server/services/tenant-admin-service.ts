import { centralDb, getTenantDb } from "../db";
import * as centralSchema from "../db/central-schema";
import { TenantConfig } from "../db/tenant-config";

import { env } from "$env/dynamic/private";
import { eq } from "drizzle-orm";
import logger from "$lib/logger";

if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

export class TenantAdminService {
	#config!: TenantConfig;
	#db: Awaited<ReturnType<typeof getTenantDb>> | null = null;

	private constructor(public readonly tenantId: string) {}

	static async createTenant(newTenant: centralSchema.InsertTenant) {
		const log = logger.setContext("TenantAdminService");
		log.debug("Creating new tenant", {
			shortName: newTenant.shortName,
			longName: newTenant.longName
		});

		const configuration: Record<string, boolean | number | string> = {
			brandColor: "#E11E15",
			defaultLanguage: "DE",
			maxChannels: -1,
			maxTeamMembers: -1,
			autoDeleteDays: 30,
			requireEmail: true,
			requirePhone: false
		};

		const urlParts = env.DATABASE_URL.split("/");
		urlParts.pop();
		newTenant.databaseUrl = urlParts.join("/") + "/" + newTenant.shortName;

		try {
			const tenant = await centralDb
				.insert(centralSchema.tenant)
				.values(newTenant)
				.returning({ id: centralSchema.tenant.id });

			log.debug("Tenant created in database", {
				tenantId: tenant[0].id,
				shortName: newTenant.shortName
			});

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

			log.debug("Tenant service created successfully", { tenantId: tenant[0].id });
			return tenantService;
		} catch (error) {
			log.error("Failed to create tenant", {
				shortName: newTenant.shortName,
				error: String(error)
			});
			throw error;
		}
	}

	static async getTenantById(id: string) {
		const log = logger.setContext("TenantAdminService");
		log.debug("Getting tenant by ID", { tenantId: id });

		try {
			const tenant = new TenantAdminService(id);
			tenant.#config = await TenantConfig.create(id);

			log.debug("Tenant service loaded successfully", { tenantId: id });
			return tenant;
		} catch (error) {
			log.error("Failed to get tenant by ID", { tenantId: id, error: String(error) });
			throw error;
		}
	}

	async update(updateData: Partial<Omit<centralSchema.InsertTenant, "id">>) {
		const log = logger.setContext("TenantAdminService");
		log.debug("Updating tenant", {
			tenantId: this.tenantId,
			updateFields: Object.keys(updateData)
		});

		try {
			await centralDb
				.update(centralSchema.tenant)
				.set(updateData)
				.where(eq(centralSchema.tenant.id, this.tenantId));

			log.debug("Tenant updated successfully", {
				tenantId: this.tenantId,
				updateFields: Object.keys(updateData)
			});
		} catch (error) {
			log.error("Failed to update tenant", { tenantId: this.tenantId, error: String(error) });
			throw error;
		}
	}

	get configuration() {
		return this.#config;
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

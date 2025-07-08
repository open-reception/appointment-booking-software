import { centralDb, getTenantDb } from "../db";
import * as centralSchema from "../db/central-schema";
import { TenantConfig } from "../db/tenant-config";

import { env } from "$env/dynamic/private";
import { eq } from "drizzle-orm";

if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

export class TenantAdminService {
	#config!: TenantConfig;
	#db: Awaited<ReturnType<typeof getTenantDb>> | null = null;

	private constructor(public readonly tenantId: string) {}

	static async createTenant(newTenant: centralSchema.InsertTenant) {
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
		const tenant = await centralDb
			.insert(centralSchema.tenant)
			.values(newTenant)
			.returning({ id: centralSchema.tenant.id });
		const config = await TenantConfig.create(tenant[0].id);
		for (const [key, value] of Object.entries(configuration)) {
			config.setConfig(key, value);
		}
		const tenantService = new TenantAdminService(tenant[0].id);
		tenantService.#config = config;
		return tenantService;
	}

	static async getTenantById(id: string) {
		const tenant = new TenantAdminService(id);
		tenant.#config = await TenantConfig.create(id);
		return tenant;
	}

	async update(updateData: Partial<Omit<centralSchema.InsertTenant, "id">>) {
		await centralDb
			.update(centralSchema.tenant)
			.set(updateData)
			.where(eq(centralSchema.tenant.id, this.tenantId));
	}

	get configuration() {
		return this.#config;
	}

	/**
	 * Get the tenant's database connection (cached)
	 */
	async getDb() {
		if (!this.#db) {
			this.#db = await getTenantDb(this.tenantId);
		}
		return this.#db;
	}
}

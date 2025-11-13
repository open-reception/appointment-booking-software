import { getTenantDb } from "./index";
import { TenantConfig } from "./tenant-config";
import * as tenantSchema from "./tenant-schema";
import { eq } from "drizzle-orm";

/**
 * Helper class for tenant-specific database operations
 * Provides a clean interface for working with tenant data
 */
export class TenantService {
  #db: Awaited<ReturnType<typeof getTenantDb>> | null = null;
  #config?: TenantConfig;

  constructor(public readonly tenantId: string) {
    this.tenantId = tenantId;
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

  /**
   * Get all client tunnels for this tenant
   */
  async getClientTunnels() {
    const db = await this.getDb();
    return await db.select().from(tenantSchema.clientAppointmentTunnel);
  }

  /**
   * Get all channels for this tenant
   */
  async getChannels() {
    const db = await this.getDb();
    return await db
      .select()
      .from(tenantSchema.channel)
      .where(eq(tenantSchema.channel.archived, false));
  }

  /**
   * Get all appointments for this tenant
   */
  async getAppointments() {
    const db = await this.getDb();
    return await db.select().from(tenantSchema.appointment);
  }

  /**
   * Get tenant configuration
   */
  async getConfig() {
    if (!this.#config) {
      this.#config = await TenantConfig.create(this.tenantId);
    }
    return this.#config.configuration;
  }
}

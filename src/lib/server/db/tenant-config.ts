import { centralDb } from "./index";
import * as centralSchema from "./central-schema";
import { eq, sql } from "drizzle-orm";

export class TenantConfig {
  private constructor(public readonly tenantId: string) {}
  #configuration: Record<string, boolean | number | string> = {};

  public get configuration(): Record<string, boolean | number | string> {
    return this.#configuration;
  }

  public static async create(tenantId: string) {
    const tenant = new TenantConfig(tenantId);
    const configEntries = await tenant.#getTenantConfig();
    tenant.#configuration = configEntries.reduce(
      (acc: Record<string, boolean | number | string>, entry) => {
        switch (entry.type) {
          case "BOOLEAN":
            acc[entry.name] = entry.value == "true";
            break;
          case "NUMBER":
            acc[entry.name] = parseFloat(entry.value);
            break;
          case "STRING":
            acc[entry.name] = entry.value;
        }
        return acc;
      },
      {} as Record<string, boolean | number | string>,
    );
    return tenant;
  }

  public async setConfig(key: string, value: boolean | number | string): Promise<void> {
    await centralDb
      .insert(centralSchema.tenantConfig)
      .values({
        tenantId: this.tenantId,
        type: this.#getType(value),
        name: key,
        value: value.toString(),
      })
      .onConflictDoUpdate({
        target: [centralSchema.tenantConfig.tenantId, centralSchema.tenantConfig.name],
        set: {
          type: sql`excluded.type`,
          value: sql`excluded.value`,
        },
      });
    this.#configuration[key] = value;
  }

  #getType(value: boolean | number | string): "BOOLEAN" | "NUMBER" | "STRING" {
    if (typeof value == "boolean") {
      return "BOOLEAN";
    }
    if (typeof value == "number") {
      return "NUMBER";
    }
    return "STRING";
  }

  /**
   * Get tenant configuration entries by tenant ID
   * @param tenantId - The tenant's UUID
   * @returns Promise<SelectTenantConfig[]> - Array of config entries
   */
  async #getTenantConfig(): Promise<centralSchema.SelectTenantConfig[]> {
    return await centralDb
      .select()
      .from(centralSchema.tenantConfig)
      .where(eq(centralSchema.tenantConfig.tenantId, this.tenantId));
  }
}

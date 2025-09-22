import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as centralSchema from "./central-schema";
import * as tenantSchema from "./tenant-schema";
import { env } from "$env/dynamic/private";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";

if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

// Central database connection for tenant management
const centralClient = postgres(env.DATABASE_URL);
export const centralDb = drizzle(centralClient, { schema: centralSchema });

// Cache for tenant database connections
const tenantDbCache = new Map<string, PostgresJsDatabase<typeof tenantSchema>>();

/**
 * Get a database connection for a specific tenant
 * @param tenantId - The tenant's UUID
 * @returns Promise<PostgresJsDatabase> - The tenant's database connection
 */
export async function getTenantDb(
  tenantId: string,
): Promise<PostgresJsDatabase<typeof tenantSchema>> {
  // Check cache first
  if (tenantDbCache.has(tenantId)) {
    return tenantDbCache.get(tenantId)!;
  }

  // Get tenant configuration from central database
  const tenant = await centralDb
    .select()
    .from(centralSchema.tenant)
    .where(eq(centralSchema.tenant.id, tenantId))
    .limit(1);

  if (tenant.length === 0) {
    throw new Error(`Tenant with ID ${tenantId} not found`);
  }

  // Create tenant-specific database connection
  const tenantClient = postgres(tenant[0].databaseUrl);
  const tenantDb = drizzle(tenantClient, { schema: tenantSchema });

  // Cache the connection
  tenantDbCache.set(tenantId, tenantDb);

  return tenantDb;
}

/**
 * Get tenant information by ID
 * @param tenantId - The tenant's UUID
 * @returns Promise<SelectTenant> - The tenant object
 */
export async function getTenant(tenantId: string): Promise<centralSchema.SelectTenant> {
	const tenant = await centralDb
		.select()
		.from(centralSchema.tenant)
		.where(eq(centralSchema.tenant.id, tenantId))
		.limit(1);

	if (tenant.length === 0) {
		throw new Error(`Tenant with ID ${tenantId} not found`);
	}

	return tenant[0];
}

/**
 * Clear cached database connections (useful for testing or tenant updates)
 */
export function clearTenantDbCache(): void {
  tenantDbCache.clear();
}

// Legacy export for backward compatibility (points to central DB)
export const db = centralDb;

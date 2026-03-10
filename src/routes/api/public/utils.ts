import { dev } from "$app/environment";
import logger from "$lib/logger";
import { db } from "$lib/server/db";
import { tenant } from "$lib/server/db/central-schema";
import { eq } from "drizzle-orm";

export const getTenantIdByDomain = async (
  domain: string,
  chooseFirstTenantLocally?: boolean,
): Promise<string | null> => {
  if (dev && chooseFirstTenantLocally) {
    // Get the first tenant ID in development
    const tenants = await db
      .select({
        id: tenant.id,
      })
      .from(tenant)
      .orderBy(tenant.shortName)
      .limit(1);
    return tenants[0].id || null;
  } else {
    // Get tenant ID by domain in production
    const shortName = domain.replace("https://", "").split(".")[0];
    try {
      const tenants = await db
        .select({
          id: tenant.id,
        })
        .from(tenant)
        .where(eq(tenant.shortName, shortName))
        .limit(1);
      return tenants[0]?.id || null;
    } catch (error) {
      logger
        .setContext("API.Public.Utils")
        .error("Failed to get tenant ID by domain", { domain, error });
      throw error;
    }
  }
};

import { dev } from "$app/environment";
import { db } from "$lib/server/db";
import { tenant } from "$lib/server/db/central-schema";
import { eq } from "drizzle-orm";

export const getTenantIdByDomain = async (domain: string): Promise<string | null> => {
  if (dev) {
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
    const tenants = await db
      .select({
        id: tenant.id,
      })
      .from(tenant)
      .where(eq(tenant.shortName, shortName))
      .limit(1);
    return tenants[0].id || null;
  }
};

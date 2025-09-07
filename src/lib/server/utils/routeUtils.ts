import { SessionService } from "../auth/session-service";
import { TenantAdminService } from "../services/tenant-admin-service";
import { NotFoundError } from "./errors";

/**
 * Utility function to return the tenant data for
 * @param sessionToken
 * @returns core data and configuration of the active tenant
 */
export const getTenantForSession = async (sessionToken: string) => {
  const session = await SessionService.getUserFromSession(sessionToken);
  if (!session || !session.tenantId) throw new NotFoundError("Unknown session token");
  const tenant = await TenantAdminService.getTenantById(session.tenantId);
  const tenantData = tenant.tenantData;
  return { tenantData, config: tenant.configuration };
};

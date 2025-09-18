import { AuthenticationError, AuthorizationError } from "./errors";

/**
 * Check whether the user can access the data within a route.
 * @param locals locals object containing the user information
 * @param tenantId tenant id
 * @returns error Response if permission check failed
 */
export const checkPermission = (
  locals: App.Locals,
  tenantId: string | null,
  administrative: boolean = false,
  global: boolean = false,
): void => {
  if (!locals.user) {
    throw new AuthenticationError();
  }
  if (locals.user.role === "GLOBAL_ADMIN") {
    // Global admin can view absences for any tenant
    return;
  } else if (
    !global &&
    locals.user.role === "TENANT_ADMIN" &&
    tenantId != null &&
    locals.user.tenantId === tenantId
  ) {
    // Tenant admin and staff can view absences for their own tenant
    return;
  } else if (
    !global &&
    !administrative &&
    locals.user.role === "STAFF" &&
    tenantId != null &&
    locals.user.tenantId === tenantId
  ) {
    // Tenant admin and staff can view absences for their own tenant
    return;
  } else {
    throw new AuthorizationError();
  }
};

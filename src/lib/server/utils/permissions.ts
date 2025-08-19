import { json } from "@sveltejs/kit";

/**
 * Check whether the user can access the data within a route.
 * @param locals locals object containing the user information
 * @param tenantId tenant id
 * @returns error Response if permission check failed
 */
export const checkPermission = (
	locals: App.Locals,
	tenantId: string | null,
	administrative: boolean = false
): Response | null => {
	if (!locals.user) {
		return json({ error: "Authentication required" }, { status: 401 });
	}
	if (locals.user.role === "GLOBAL_ADMIN") {
		// Global admin can view absences for any tenant
		return null;
	} else if (locals.user.role === "TENANT_ADMIN" && locals.user.tenantId === tenantId) {
		// Tenant admin and staff can view absences for their own tenant
		return null;
	} else if (!administrative && locals.user.role === "STAFF" && locals.user.tenantId === tenantId) {
		// Tenant admin and staff can view absences for their own tenant
		return null;
	} else {
		return json({ error: "Insufficient permissions" }, { status: 403 });
	}
};

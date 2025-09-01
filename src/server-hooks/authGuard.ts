import { redirect, type Handle } from "@sveltejs/kit";
import { SessionService } from "$lib/server/auth/session-service";
import { AuthorizationService } from "$lib/server/auth/authorization-service";
import { getAccessToken } from "./utils/accessToken";
import { ROUTES } from "$lib/const/routes";
import { auth } from "$lib/stores/auth";

export const authGuard: Handle = async ({ event, resolve }) => {
	const { url } = event;
	const path = url.pathname;

	// Do not handle api paths
	if (path.startsWith("/api")) {
		return resolve(event);
	}

	// Only guard protected routes
	const isDashboardRoute = path.startsWith(ROUTES.DASHBOARD.MAIN);
	if (isDashboardRoute) {
		// Check for accessToken
		const accessToken: string | null = getAccessToken(event);
		if (!accessToken) redirect(302, ROUTES.LOGIN);

		// Verify access token with database session check
		const sessionData = await SessionService.validateTokenWithDB(accessToken);
		if (!sessionData) redirect(302, ROUTES.LOGIN);

		// Set user in auth store for SSR
		auth.setUser({
			id: sessionData.user.id,
			email: sessionData.user.email,
			name: sessionData.user.name,
			role: sessionData.user.role,
			tenantId: sessionData.user.tenantId
		});

		switch (true) {
			case isDashboardRoute &&
				AuthorizationService.hasAnyRole(sessionData.user, [
					"GLOBAL_ADMIN",
					"TENANT_ADMIN",
					"STAFF"
				]):
				return resolve(event);
			default:
				// Access not granted
				redirect(302, ROUTES.LOGIN);
		}
	}

	return resolve(event);
};

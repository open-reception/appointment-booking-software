import type { Handle } from "@sveltejs/kit";
import { SessionService } from "$lib/server/auth/session-service";
import { UniversalLogger } from "$lib/logger";
import { AuthorizationService } from "$lib/server/auth/authorization-service";

const logger = new UniversalLogger().setContext("AuthHandle");

const ACCESS_TOKEN_COOKIE_NAME = "access_token";
const PROTECTED_PATHS = ["/api/admin", "/api/tenant-admin", "/api/tenants", "/api/auth/register"];
const PUBLIC_PATHS = [
	"/api/auth/challenge",
	"/api/auth/login",
	"/api/auth/register",
	"/api/auth/confirm",
	"/api/auth/resend-confirmation",
	"/api/health",
	"/api/docs",
	"/api/openapi.json",
	"/api/env",
	"/api/log",
	"/api/admin/init",
	"/api/admin/exists"
];
const GLOBAL_ADMIN_PATHS = ["/api/admin", "/api/tenants"];
const ADMIN_PATHS = ["/api/tenant-admin"];

const PROTECTED_AUTH_PATHS = [
	"/api/auth/logout",
	"/api/auth/refresh",
	"/api/auth/session",
	"/api/auth/sessions",
	"/api/auth/passkeys",
	"/api/auth/invite"
];

export const authHandle: Handle = async ({ event, resolve }) => {
	const { url, request } = event;
	const path = url.pathname;

	const isProtectedPath = PROTECTED_PATHS.some((protectedPath) => path.startsWith(protectedPath));
	const isPublicPath = PUBLIC_PATHS.some((publicPath) => path.startsWith(publicPath));
	const isProtectedAuthPath = PROTECTED_AUTH_PATHS.some((authPath) => path.startsWith(authPath));
	const isGlobalAdminPath = GLOBAL_ADMIN_PATHS.some((gadPath) => path.startsWith(gadPath));
	const isAdminPath = ADMIN_PATHS.some((gadPath) => path.startsWith(gadPath));

	// Allow public paths
	if (isPublicPath) {
		return resolve(event);
	}

	// Require authentication for protected paths and protected auth paths
	if (!isProtectedPath && !isProtectedAuthPath) {
		return new Response(
			JSON.stringify({ error: `Path ${path} not handled by auth. This is an error` }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" }
			}
		);
	}

	let accessToken: string | null = null;

	// Get access token from cookie
	const accessTokenCookie = event.cookies.get(ACCESS_TOKEN_COOKIE_NAME);
	if (accessTokenCookie) {
		accessToken = accessTokenCookie;
	}

	// Fallback: check Authorization header
	if (!accessToken) {
		const authHeader = request.headers.get("authorization");
		if (authHeader?.startsWith("Bearer ")) {
			accessToken = authHeader.substring(7);
		}
	}

	if (!accessToken) {
		logger.warn(`Authentication required for ${path}`);
		return new Response(JSON.stringify({ error: "Authentication required" }), {
			status: 401,
			headers: { "Content-Type": "application/json" }
		});
	}

	// Verify access token with database session check
	const sessionData = await SessionService.validateTokenWithDB(accessToken);
	if (!sessionData) {
		logger.warn(`Invalid or revoked access token for ${path}`);
		return new Response(JSON.stringify({ error: "Invalid or expired access token" }), {
			status: 401,
			headers: { "Content-Type": "application/json" }
		});
	}

	// Add sessionId to the user object for easy access
	event.locals.user = {
		userId: sessionData.user.id,
		...sessionData.user,
		sessionId: sessionData.sessionId
	};

	if (isGlobalAdminPath && !AuthorizationService.hasRole(sessionData.user, "GLOBAL_ADMIN")) {
		return new Response(JSON.stringify({ error: "Authentication failed" }), {
			status: 403,
			headers: { "Content-Type": "application/json" }
		});
	} else if (
		isAdminPath &&
		!AuthorizationService.hasAnyRole(sessionData.user, ["GLOBAL_ADMIN", "TENANT_ADMIN"])
	) {
		return new Response(JSON.stringify({ error: "Authentication failed" }), {
			status: 403,
			headers: { "Content-Type": "application/json" }
		});
	}
	// Protected auth paths require any authenticated user (no specific role required)
	// The authentication check above is sufficient

	logger.debug(`User authenticated: ${sessionData.user.email} for ${path}`);

	return resolve(event);
};

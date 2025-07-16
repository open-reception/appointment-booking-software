import type { Handle } from "@sveltejs/kit";
import { SessionService } from "$lib/server/auth/session-service";
import { verifyAccessToken } from "$lib/server/auth/jwt-utils";
import { UniversalLogger } from "$lib/logger";
import type { JWTPayload } from "jose";
import { AuthorizationService } from "$lib/server/auth/authorization-service";

const logger = new UniversalLogger().setContext("AuthHandle");

const SESSION_COOKIE_NAME = "session";
const PROTECTED_PATHS = ["/api/admin", "/api/tenant-admin"];
const PUBLIC_PATHS = [
	"/api/auth",
	"/api/health",
	"/api/docs",
	"/api/admin/init",
	"/api/admin/confirm",
	"/api/admin/exists"
];
const GLOBAL_ADMIN_PATHS = ["/api/admin"];
const ADMIN_PATHS = ["/api/tenant-admin"];

export const authHandle: Handle = async ({ event, resolve }) => {
	const { url, request } = event;
	const path = url.pathname;

	const isProtectedPath = PROTECTED_PATHS.some((protectedPath) => path.startsWith(protectedPath));
	const isPublicPath = PUBLIC_PATHS.some((publicPath) => path.startsWith(publicPath));
	const isGlobalAdminPath = GLOBAL_ADMIN_PATHS.some((gadPath) => path.startsWith(gadPath));
	const isAdminPath = ADMIN_PATHS.some((gadPath) => path.startsWith(gadPath));

	if (!isProtectedPath || isPublicPath) {
		return resolve(event);
	}

	let sessionToken: string | null = null;
	let accessToken: string | null = null;

	const sessionCookie = event.cookies.get(SESSION_COOKIE_NAME);
	if (sessionCookie) {
		sessionToken = sessionCookie;
	}

	const authHeader = request.headers.get("authorization");
	if (authHeader?.startsWith("Bearer ")) {
		accessToken = authHeader.substring(7);
	}

	if (!sessionToken && !accessToken) {
		logger.warn(`Authentication required for ${path}`);
		return new Response(JSON.stringify({ error: "Authentication required" }), {
			status: 401,
			headers: { "Content-Type": "application/json" }
		});
	}

	let user: JWTPayload | null = null;

	if (accessToken) {
		user = await verifyAccessToken(accessToken);
		if (!user) {
			logger.warn(`Invalid access token for ${path}`);
			return new Response(JSON.stringify({ error: "Invalid access token" }), {
				status: 401,
				headers: { "Content-Type": "application/json" }
			});
		}
	} else if (sessionToken) {
		const sessionData = await SessionService.validateSession(sessionToken);
		if (!sessionData) {
			logger.warn(`Invalid session for ${path}`);
			return new Response(JSON.stringify({ error: "Invalid session" }), {
				status: 401,
				headers: { "Content-Type": "application/json" }
			});
		}
		user = await verifyAccessToken(sessionData.accessToken);
	}

	if (!user) {
		logger.warn(`Authentication failed for ${path}`);
		return new Response(JSON.stringify({ error: "Authentication failed" }), {
			status: 401,
			headers: { "Content-Type": "application/json" }
		});
	}

	event.locals.user = user;
	event.locals.sessionToken = sessionToken || undefined;
	if (isGlobalAdminPath && !AuthorizationService.hasRole(user, "GLOBAL_ADMIN")) {
		return new Response(JSON.stringify({ error: "Authentication failed" }), {
			status: 401,
			headers: { "Content-Type": "application/json" }
		});
	} else if (
		isAdminPath &&
		!AuthorizationService.hasAnyRole(user, ["GLOBAL_ADMIN", "TENANT_ADMIN"])
	) {
		return new Response(JSON.stringify({ error: "Authentication failed" }), {
			status: 401,
			headers: { "Content-Type": "application/json" }
		});
	}

	logger.debug(`User authenticated: ${user.email} for ${path}`);

	return resolve(event);
};

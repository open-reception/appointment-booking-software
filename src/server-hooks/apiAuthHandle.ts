import type { Handle } from "@sveltejs/kit";
import { SessionService } from "$lib/server/auth/session-service";
import { UniversalLogger } from "$lib/logger";
import { AuthorizationService } from "$lib/server/auth/authorization-service";
import { getAccessToken } from "./utils/accessToken";
import type { SelectUser } from "$lib/server/db/central-schema";

const logger = new UniversalLogger().setContext("AuthHandle");

const GLOBAL_ADMIN_PATHS = ["/api/admin"];

export const apiAuthHandle: Handle = async ({ event, resolve }) => {
  const { url } = event;
  const path = url.pathname;

  // Public api paths should be available without authentication
  const whitelist = ["/api/public"];
  const skip = whitelist.some((wlPath) => path.startsWith(wlPath));
  if (skip) {
    return resolve(event);
  }

  // Front-End routes are not handled here
  if (!path.startsWith("/api")) {
    return resolve(event);
  }

  // Check for tenant client booking routes (public for clients)
  const isGlobalAdminPath = GLOBAL_ADMIN_PATHS.some((gadPath) => path.startsWith(gadPath));
  const isAdminPath = false;

  const accessToken: string | null = getAccessToken(event);
  let sessionData: {
    user: SelectUser;
    sessionId: string;
    exp: Date;
    passkeyId?: string;
  } | null = null;
  if (accessToken) {
    // Verify access token with database session check
    sessionData = await SessionService.validateTokenWithDB(accessToken);
    if (!sessionData) {
      logger.warn(`Invalid or revoked access token for ${path}`);
      return new Response(JSON.stringify({ error: "Invalid or expired access token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Add sessionId and passkeyId to the user object for easy access
    event.locals.user = {
      session: {
        exp: sessionData.exp.valueOf(),
        sessionId: sessionData.sessionId,
      },
      ...sessionData.user,
    };
  }

  // Allow public paths and tenant client booking routes
  if (!isGlobalAdminPath) {
    return resolve(event);
  }

  if (!accessToken) {
    logger.warn(`Authentication required for ${path}`);
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (
    isGlobalAdminPath &&
    (!sessionData || !AuthorizationService.hasRole(sessionData?.user, "GLOBAL_ADMIN"))
  ) {
    return new Response(JSON.stringify({ error: "Authentication failed" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  } else if (
    isAdminPath &&
    (!sessionData ||
      !AuthorizationService.hasAnyRole(sessionData.user, ["GLOBAL_ADMIN", "TENANT_ADMIN"]))
  ) {
    return new Response(JSON.stringify({ error: "Authentication failed" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  // Protected auth paths require any authenticated user (no specific role required)
  // The authentication check above is sufficient

  logger.debug(`User authenticated: ${sessionData?.user.email ?? "unauthenticated"} for ${path}`);

  return resolve(event);
};

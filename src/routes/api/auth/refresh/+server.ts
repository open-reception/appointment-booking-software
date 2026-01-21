import { json } from "@sveltejs/kit";
import { SessionService } from "$lib/server/auth/session-service";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { UniversalLogger } from "$lib/logger";
import { isBefore, subMinutes } from "date-fns";
import { decodeAccessToken } from "$lib/server/auth/jwt-utils";

const logger = new UniversalLogger().setContext("AuthRefreshAPI");
const REFRESH_OFFSET = 10;

registerOpenAPIRoute("/auth/refresh", "POST", {
  summary: "Refresh access token",
  description: "Generate new access and refresh tokens using the current session",
  tags: ["Authentication"],
  responses: {
    "200": {
      description: "Token refresh successful",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Success message" },
              expiresAt: {
                type: "string",
                format: "date-time",
                description: "New expiration time",
              },
            },
            required: ["message", "expiresAt"],
          },
        },
      },
    },
    "400": {
      description: "No valid session found",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "401": {
      description: "Refresh token expired or invalid",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "500": {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
  },
});

export const POST: RequestHandler = async ({ cookies }) => {
  try {
    // Get current access token from cookie to extract session info
    const accessToken = cookies.get("access_token");

    if (!accessToken) {
      return json({ error: "Access token is required" }, { status: 400 });
    }

    // Get the (possibly invalid) session from the database
    const decodedToken = await decodeAccessToken(accessToken);
    const oldSessionId = decodedToken?.sessionId ?? null;
    const oldSession = oldSessionId ? await SessionService.getUserSession(oldSessionId) : null;

    if (!oldSession) {
      return json({ error: "No valid session found for user" }, { status: 401 });
    }

    if (isBefore(oldSession.expiresAt, subMinutes(new Date(), REFRESH_OFFSET))) {
      return json(
        {
          message: "Session still valid, no refresh needed",
          expiresAt: oldSession.expiresAt.toISOString(),
        },
        { status: 200 },
      );
    }

    const result = await SessionService.refreshSession(oldSession.refreshToken);

    if (!result) {
      return json({ error: "Invalid or expired refresh token" }, { status: 401 });
    }

    logger.info("Token refresh successful");

    // Set HTTP-only cookie for new access token
    cookies.set("access_token", result.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      expires: result.expiresAt,
    });

    return json({
      message: "Token refresh successful",
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (error) {
    logger.error("Token refresh error:", { error: String(error) });
    return json({ error: "Internal server error" }, { status: 500 });
  }
};

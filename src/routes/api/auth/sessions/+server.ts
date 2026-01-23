import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { SessionService } from "$lib/server/auth/session-service";
import { UniversalLogger } from "$lib/logger";

const logger = new UniversalLogger().setContext("AuthSessionsAPI");

registerOpenAPIRoute("/auth/sessions", "GET", {
  summary: "Get all active sessions",
  description: "Retrieve all active sessions for the current user",
  tags: ["Authentication"],
  responses: {
    "200": {
      description: "Active sessions retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              sessions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", description: "Session ID" },
                    ipAddress: { type: "string", description: "IP address of session" },
                    userAgent: { type: "string", description: "User agent string" },
                    createdAt: {
                      type: "string",
                      format: "date-time",
                      description: "Session creation time",
                    },
                    lastUsedAt: {
                      type: "string",
                      format: "date-time",
                      description: "Last activity time",
                    },
                    expiresAt: {
                      type: "string",
                      format: "date-time",
                      description: "Session expiration time",
                    },
                    current: {
                      type: "boolean",
                      description: "Whether this is the current session",
                    },
                  },
                  required: ["id", "createdAt", "lastUsedAt", "expiresAt", "current"],
                },
              },
            },
            required: ["sessions"],
          },
        },
      },
    },
    "401": {
      description: "Not authenticated",
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

registerOpenAPIRoute("/auth/sessions", "DELETE", {
  summary: "Logout all sessions",
  description: "Invalidate all active sessions for the current user",
  tags: ["Authentication"],
  responses: {
    "200": {
      description: "All sessions logged out successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Success message" },
            },
            required: ["message"],
          },
        },
      },
    },
    "401": {
      description: "Not authenticated",
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

export const GET: RequestHandler = async ({ locals }) => {
  try {
    if (!locals.user) {
      return json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get all active sessions for the user from database
    const activeSessions = await SessionService.getActiveSessions(locals.user.id);

    // Get current session ID from access token
    const currentSessionId = locals.user.session.sessionId;

    const sessions = activeSessions.map((session) => ({
      id: session.id,
      ipAddress: session.ipAddress || "unknown",
      userAgent: session.userAgent || "unknown",
      createdAt: session.createdAt?.toISOString() || new Date().toISOString(),
      lastUsedAt: session.lastUsedAt?.toISOString() || new Date().toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      current: session.id === currentSessionId,
    }));

    logger.debug("Active sessions retrieved from database", {
      userId: locals.user.id,
      sessionCount: sessions.length,
    });

    return json({ sessions });
  } catch (error) {
    logger.error("Get sessions error:", { error: String(error) });
    return json({ error: "Internal server error" }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ locals, cookies }) => {
  try {
    if (!locals.user) {
      return json({ error: "Not authenticated" }, { status: 401 });
    }

    // Logout all sessions for the user
    await SessionService.logoutAllSessions(locals.user.id);

    // Clear the current access token cookie
    cookies.delete("access_token", {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    logger.info("All sessions logged out", { userId: locals.user.id });

    return json({ message: "Logged out successfully" });
  } catch (error) {
    logger.error("Logout all sessions error:", { error: String(error) });
    return json({ error: "Internal server error" }, { status: 500 });
  }
};

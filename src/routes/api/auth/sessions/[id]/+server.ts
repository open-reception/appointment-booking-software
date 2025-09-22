import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { SessionService } from "$lib/server/auth/session-service";
import { UniversalLogger } from "$lib/logger";

const logger = new UniversalLogger().setContext("AuthSessionAPI");

registerOpenAPIRoute("/auth/sessions/{id}", "DELETE", {
  summary: "Revoke specific session",
  description:
    "Revoke a specific session by ID. Global admins can revoke any session, regular users can only revoke their own sessions.",
  tags: ["Authentication"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Session ID to revoke",
    },
  ],
  responses: {
    "200": {
      description: "Session revoked successfully",
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
    "403": {
      description: "Insufficient permissions",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "404": {
      description: "Session not found",
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

export const DELETE: RequestHandler = async ({ params, locals, cookies }) => {
  try {
    const sessionId = params.id;

    if (!locals.user) {
      return json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!sessionId) {
      return json({ error: "Session ID is required" }, { status: 400 });
    }

    logger.debug("Revoking session", {
      sessionId,
      requestedBy: locals.user.userId,
      userRole: locals.user.role,
    });

    // Get current session ID from locals (set by auth middleware)
    const currentSessionId = locals.user.sessionId;

    // Check if user is trying to revoke their own session or if they're a global admin
    if (locals.user.role === "GLOBAL_ADMIN") {
      // Global admins can revoke any session
      await SessionService.revokeSession(sessionId);
    } else {
      // Regular users can only revoke their own sessions
      // First, get all user's sessions to verify ownership
      const userSessions = await SessionService.getActiveSessions(locals.user.userId);
      const sessionToRevoke = userSessions.find((session) => session.id === sessionId);

      if (!sessionToRevoke) {
        return json({ error: "Session not found or access denied" }, { status: 404 });
      }

      await SessionService.revokeSession(sessionId);
    }

    // If the user revoked their current session, clear the cookie
    if (sessionId === currentSessionId) {
      cookies.delete("access_token", {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "strict",
      });
      logger.info("Current session revoked, cookie cleared", {
        sessionId,
        userId: locals.user.userId,
      });
    }

    logger.info("Session revoked successfully", {
      sessionId,
      revokedBy: locals.user.userId,
      wasCurrent: sessionId === currentSessionId,
    });

    return json({ message: "Session revoked successfully" });
  } catch (error) {
    logger.error("Revoke session error:", {
      error: String(error),
      sessionId: params.id,
      userId: locals.user?.userId,
    });
    return json({ error: "Internal server error" }, { status: 500 });
  }
};

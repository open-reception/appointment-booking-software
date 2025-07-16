import { json } from "@sveltejs/kit";
import { SessionService } from "$lib/server/auth/session-service";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { UniversalLogger } from "$lib/logger";

const logger = new UniversalLogger().setContext("AuthSessionRevokeAPI");

registerOpenAPIRoute("/auth/sessions/{sessionId}", "DELETE", {
	summary: "Revoke specific session",
	description: "Invalidate a specific session by ID",
	tags: ["Authentication"],
	parameters: [
		{
			name: "sessionId",
			in: "path",
			description: "Session ID to revoke",
			required: true,
			schema: { type: "string" }
		}
	],
	responses: {
		"200": {
			description: "Session revoked successfully",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							message: { type: "string", description: "Success message" }
						},
						required: ["message"]
					}
				}
			}
		},
		"401": {
			description: "Not authenticated",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" }
				}
			}
		},
		"403": {
			description: "Cannot revoke session of another user",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" }
				}
			}
		},
		"404": {
			description: "Session not found",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" }
				}
			}
		},
		"500": {
			description: "Internal server error",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" }
				}
			}
		}
	}
});

export const DELETE: RequestHandler = async ({ params, cookies }) => {
	try {
		const sessionToken = cookies.get("session");
		const sessionIdToRevoke = params.sessionId;

		if (!sessionToken) {
			return json({ error: "Not authenticated" }, { status: 401 });
		}

		const sessionData = await SessionService.validateSession(sessionToken);

		if (!sessionData) {
			return json({ error: "Invalid session" }, { status: 401 });
		}

		// Get all user sessions to verify ownership
		const userSessions = await SessionService.getActiveSessions(sessionData.user.id);
		const targetSession = userSessions.find((session) => session.id === sessionIdToRevoke);

		if (!targetSession) {
			return json({ error: "Session not found" }, { status: 404 });
		}

		// Check if trying to revoke current session
		if (targetSession.sessionToken === sessionToken) {
			// Clear current session cookie
			cookies.delete("session", {
				path: "/",
				httpOnly: true,
				secure: true,
				sameSite: "strict"
			});
		}

		await SessionService.revokeSession(sessionIdToRevoke);

		logger.info("Session revoked", {
			userId: sessionData.user.id,
			revokedSessionId: sessionIdToRevoke,
			currentSession: targetSession.sessionToken === sessionToken
		});

		return json({ message: "Session revoked successfully" });
	} catch (error) {
		logger.error("Session revoke error:", { error: String(error) });
		return json({ error: "Internal server error" }, { status: 500 });
	}
};

import { json } from "@sveltejs/kit";
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

export const DELETE: RequestHandler = async ({ params, locals, cookies }) => {
	try {
		const sessionIdToRevoke = params.sessionId;

		if (!locals.user) {
			return json({ error: "Not authenticated" }, { status: 401 });
		}

		// With access token-only approach, we can only revoke the current token
		const currentSessionId = locals.user.sessionId || "current";
		
		if (sessionIdToRevoke !== currentSessionId) {
			return json({ error: "Can only revoke current session" }, { status: 404 });
		}

		// Clear access token cookie
		cookies.delete("access_token", {
			path: "/",
			httpOnly: true,
			secure: true,
			sameSite: "strict"
		});

		logger.info("Access token revoked", {
			userId: locals.user.userId,
			revokedSessionId: sessionIdToRevoke
		});

		return json({ message: "Session revoked successfully" });
	} catch (error) {
		logger.error("Session revoke error:", { error: String(error) });
		return json({ error: "Internal server error" }, { status: 500 });
	}
};

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
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
											description: "Session creation time"
										},
										lastUsedAt: {
											type: "string",
											format: "date-time",
											description: "Last activity time"
										},
										expiresAt: {
											type: "string",
											format: "date-time",
											description: "Session expiration time"
										},
										current: { type: "boolean", description: "Whether this is the current session" }
									},
									required: ["id", "createdAt", "lastUsedAt", "expiresAt", "current"]
								}
							}
						},
						required: ["sessions"]
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

export const GET: RequestHandler = async ({ locals }) => {
	try {
		// With access token-only approach, we don't track active sessions
		// Return current token info only
		if (!locals.user) {
			return json({ error: "Not authenticated" }, { status: 401 });
		}

		const currentSession = {
			id: locals.user.sessionId || "current",
			ipAddress: "unknown", // Would need to be tracked separately
			userAgent: "unknown", // Would need to be tracked separately
			createdAt: new Date(locals.user.iat! * 1000).toISOString(),
			lastUsedAt: new Date().toISOString(),
			expiresAt: new Date(locals.user.exp! * 1000).toISOString(),
			current: true
		};

		logger.debug("Current session info retrieved", {
			userId: locals.user.userId
		});

		return json({ sessions: [currentSession] });
	} catch (error) {
		logger.error("Get sessions error:", { error: String(error) });
		return json({ error: "Internal server error" }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ locals, cookies }) => {
	try {
		// With access token-only approach, just clear the current token
		if (!locals.user) {
			return json({ error: "Not authenticated" }, { status: 401 });
		}

		cookies.delete("access_token", {
			path: "/",
			httpOnly: true,
			secure: true,
			sameSite: "strict"
		});

		logger.info("Access token cleared", { userId: locals.user.userId });

		return json({ message: "Logged out successfully" });
	} catch (error) {
		logger.error("Logout error:", { error: String(error) });
		return json({ error: "Internal server error" }, { status: 500 });
	}
};

import { json } from "@sveltejs/kit";
import { SessionService } from "$lib/server/auth/session-service";
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

export const GET: RequestHandler = async ({ cookies }) => {
	try {
		const sessionToken = cookies.get("session");

		if (!sessionToken) {
			return json({ error: "Not authenticated" }, { status: 401 });
		}

		const sessionData = await SessionService.validateSession(sessionToken);

		if (!sessionData) {
			return json({ error: "Invalid session" }, { status: 401 });
		}

		const sessions = await SessionService.getActiveSessions(sessionData.user.id);

		const formattedSessions = sessions.map((session) => ({
			id: session.id,
			ipAddress: session.ipAddress,
			userAgent: session.userAgent,
			createdAt: session.createdAt?.toISOString(),
			lastUsedAt: session.lastUsedAt?.toISOString(),
			expiresAt: session.expiresAt.toISOString(),
			current: session.sessionToken === sessionToken
		}));

		logger.debug("Active sessions retrieved", {
			userId: sessionData.user.id,
			sessionCount: sessions.length
		});

		return json({ sessions: formattedSessions });
	} catch (error) {
		logger.error("Get sessions error:", { error: String(error) });
		return json({ error: "Internal server error" }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ cookies }) => {
	try {
		const sessionToken = cookies.get("session");

		if (!sessionToken) {
			return json({ error: "Not authenticated" }, { status: 401 });
		}

		const sessionData = await SessionService.validateSession(sessionToken);

		if (!sessionData) {
			return json({ error: "Invalid session" }, { status: 401 });
		}

		await SessionService.logoutAllSessions(sessionData.user.id);

		cookies.delete("session", {
			path: "/",
			httpOnly: true,
			secure: true,
			sameSite: "strict"
		});

		logger.info("All sessions logged out", { userId: sessionData.user.id });

		return json({ message: "All sessions logged out successfully" });
	} catch (error) {
		logger.error("Logout all sessions error:", { error: String(error) });
		return json({ error: "Internal server error" }, { status: 500 });
	}
};

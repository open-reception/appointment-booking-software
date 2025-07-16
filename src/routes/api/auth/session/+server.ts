import { json } from "@sveltejs/kit";
import { SessionService } from "$lib/server/auth/session-service";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { UniversalLogger } from "$lib/logger";

const logger = new UniversalLogger().setContext("AuthSessionAPI");

registerOpenAPIRoute("/auth/session", "GET", {
	summary: "Get current session status",
	description: "Retrieve current user session information and authentication status",
	tags: ["Authentication"],
	responses: {
		"200": {
			description: "Session information retrieved successfully",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							authenticated: { type: "boolean", description: "Whether user is authenticated" },
							user: {
								type: "object",
								properties: {
									id: { type: "string", description: "User ID" },
									email: { type: "string", description: "User email" },
									name: { type: "string", description: "User name" },
									role: { type: "string", enum: ["GLOBAL_ADMIN", "TENANT_ADMIN", "STAFF"] },
									tenantId: { type: "string", description: "Tenant ID (if applicable)" }
								},
								required: ["id", "email", "name", "role"]
							},
							expiresAt: {
								type: "string",
								format: "date-time",
								description: "Session expiration time"
							}
						},
						required: ["authenticated"]
					}
				}
			}
		},
		"401": {
			description: "Not authenticated",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							authenticated: { type: "boolean", example: false },
							message: { type: "string", description: "Authentication status message" }
						},
						required: ["authenticated"]
					}
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
			return json({ authenticated: false, message: "No session found" }, { status: 401 });
		}

		const sessionData = await SessionService.validateSession(sessionToken);

		if (!sessionData) {
			cookies.delete("session", {
				path: "/",
				httpOnly: true,
				secure: true,
				sameSite: "strict"
			});
			return json({ authenticated: false, message: "Invalid or expired session" }, { status: 401 });
		}

		logger.debug("Session validated", { userId: sessionData.user.id });

		return json({
			authenticated: true,
			user: {
				id: sessionData.user.id,
				email: sessionData.user.email,
				name: sessionData.user.name,
				role: sessionData.user.role,
				tenantId: sessionData.user.tenantId
			},
			expiresAt: sessionData.expiresAt.toISOString()
		});
	} catch (error) {
		logger.error("Session validation error:", { error: String(error) });
		return json({ error: "Internal server error" }, { status: 500 });
	}
};

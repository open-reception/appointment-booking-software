import { json } from "@sveltejs/kit";
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

export const GET: RequestHandler = async ({ locals }) => {
	try {
		// User is already authenticated via authHandle
		if (!locals.user) {
			return json({ authenticated: false, message: "Not authenticated" }, { status: 401 });
		}

		logger.debug("Session check", { userId: locals.user.userId });

		return json({
			authenticated: true,
			user: {
				id: locals.user.userId,
				email: locals.user.email,
				name: locals.user.name,
				role: locals.user.role,
				tenantId: locals.user.tenantId
			},
			expiresAt: new Date(locals.user.exp ?? 0).toISOString()
		});
	} catch (error) {
		logger.error("Session check error:", { error: String(error) });
		return json({ error: "Internal server error" }, { status: 500 });
	}
};

import { json } from "@sveltejs/kit";
import { SessionService } from "$lib/server/auth/session-service";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { UniversalLogger } from "$lib/logger";

const logger = new UniversalLogger().setContext("AuthRefreshAPI");

registerOpenAPIRoute("/auth/refresh", "POST", {
	summary: "Refresh access token",
	description: "Generate new access and refresh tokens using existing refresh token",
	tags: ["Authentication"],
	requestBody: {
		description: "Refresh token data",
		content: {
			"application/json": {
				schema: {
					type: "object",
					properties: {
						refreshToken: {
							type: "string",
							description: "Current refresh token"
						}
					},
					required: ["refreshToken"]
				}
			}
		}
	},
	responses: {
		"200": {
			description: "Token refresh successful",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							message: { type: "string", description: "Success message" },
							accessToken: { type: "string", description: "New JWT access token" },
							refreshToken: { type: "string", description: "New refresh token" },
							expiresAt: { type: "string", format: "date-time", description: "New expiration time" }
						},
						required: ["message", "accessToken", "refreshToken", "expiresAt"]
					}
				}
			}
		},
		"400": {
			description: "Invalid refresh token",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" }
				}
			}
		},
		"401": {
			description: "Refresh token expired or invalid",
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

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { refreshToken } = body;

		if (!refreshToken) {
			return json({ error: "Refresh token is required" }, { status: 400 });
		}

		const result = await SessionService.refreshSession(refreshToken);

		if (!result) {
			return json({ error: "Invalid or expired refresh token" }, { status: 401 });
		}

		logger.info("Token refresh successful");

		return json({
			message: "Token refresh successful",
			accessToken: result.accessToken,
			refreshToken: result.refreshToken,
			expiresAt: result.expiresAt.toISOString()
		});
	} catch (error) {
		logger.error("Token refresh error:", { error: String(error) });
		return json({ error: "Internal server error" }, { status: 500 });
	}
};

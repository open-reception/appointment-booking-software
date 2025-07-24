import { json } from "@sveltejs/kit";
import { SessionService } from "$lib/server/auth/session-service";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { UniversalLogger } from "$lib/logger";

const logger = new UniversalLogger().setContext("AuthRefreshAPI");

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
							expiresAt: { type: "string", format: "date-time", description: "New expiration time" }
						},
						required: ["message", "expiresAt"]
					}
				}
			}
		},
		"400": {
			description: "No valid session found",
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

export const POST: RequestHandler = async ({ locals, cookies }) => {
	try {
		// Get current access token from cookie to extract session info
		const accessToken = cookies.get("access_token");

		if (!accessToken) {
			return json({ error: "Access token is required" }, { status: 400 });
		}

		// The user object is already available from authHandle,
		// so we can create a new session based on that
		if (!locals.user) {
			return json({ error: "Invalid user context" }, { status: 400 });
		}

		const result = await SessionService.createSession(
			locals.user.userId as string,
			"", // IP address - could be extracted from request if needed
			undefined // user agent
		);

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
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});

		return json({
			message: "Token refresh successful",
			expiresAt: result.expiresAt.toISOString()
		});
	} catch (error) {
		logger.error("Token refresh error:", { error: String(error) });
		return json({ error: "Internal server error" }, { status: 500 });
	}
};

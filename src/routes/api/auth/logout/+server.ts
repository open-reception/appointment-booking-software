import { json } from "@sveltejs/kit";
import { SessionService } from "$lib/server/auth/session-service";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { UniversalLogger } from "$lib/logger";

const logger = new UniversalLogger().setContext("AuthLogoutAPI");

registerOpenAPIRoute("/auth/logout", "POST", {
	summary: "Logout user session",
	description: "Invalidate current user session and clear session cookie",
	tags: ["Authentication"],
	responses: {
		"200": {
			description: "Logout successful",
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
		"400": {
			description: "No active session found",
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

export const POST: RequestHandler = async ({ cookies }) => {
	try {
		const sessionToken = cookies.get("session");

		if (!sessionToken) {
			return json({ error: "No active session found" }, { status: 400 });
		}

		await SessionService.logout(sessionToken);

		cookies.delete("session", {
			path: "/",
			httpOnly: true,
			secure: true,
			sameSite: "strict"
		});

		logger.info("Logout successful");

		return json({ message: "Logout successful" });
	} catch (error) {
		logger.error("Logout error:", { error: String(error) });
		return json({ error: "Internal server error" }, { status: 500 });
	}
};

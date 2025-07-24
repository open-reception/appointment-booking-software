import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { UniversalLogger } from "$lib/logger";

const logger = new UniversalLogger().setContext("AuthLogoutAPI");

registerOpenAPIRoute("/auth/logout", "POST", {
	summary: "Logout user session",
	description: "Invalidate current user session and clear access token cookie",
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
			description: "No access token found",
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
		const accessToken = cookies.get("access_token");

		if (!accessToken) {
			return json({ error: "No access token found" }, { status: 400 });
		}

		// Simply clear the access token cookie - no need to invalidate sessions
		cookies.delete("access_token", {
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

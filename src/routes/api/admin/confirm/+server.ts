import { json } from "@sveltejs/kit";
import { AdminAccountService } from "$lib/server/services/admin-account-service";
import { NotFoundError } from "$lib/server/utils/errors";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";

// Register OpenAPI documentation
registerOpenAPIRoute("/admin/confirm", "POST", {
	summary: "Confirm admin account",
	description: "Confirms an admin account using the email confirmation token",
	tags: ["Admin"],
	requestBody: {
		description: "Confirmation token",
		content: {
			"application/json": {
				schema: {
					type: "object",
					properties: {
						token: { type: "string", description: "Confirmation token from email", example: "01234567-89ab-cdef-0123-456789abcdef" }
					},
					required: ["token"]
				}
			}
		}
	},
	responses: {
		"200": {
			description: "Admin account confirmed successfully",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							message: { type: "string", description: "Success message" }
						},
						required: ["message"]
					},
					example: {
						message: "Admin account confirmed successfully. You can now log in."
					}
				}
			}
		},
		"404": {
			description: "Invalid or expired confirmation token",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" },
					example: { error: "Invalid or expired confirmation token" }
				}
			}
		},
		"500": {
			description: "Internal server error",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" },
					example: { error: "Internal server error" }
				}
			}
		}
	}
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();

		await AdminAccountService.confirm(body.token);

		return json(
			{
				message: "Admin account confirmed successfully. You can now log in."
			},
			{ status: 200 }
		);
	} catch (error) {
		const log = logger.setContext("API");
		log.error("Admin confirmation error:", JSON.stringify(error || "?"));

		if (error instanceof NotFoundError) {
			return json({ error: "Invalid or expired confirmation token" }, { status: 404 });
		}

		return json({ error: "Internal server error" }, { status: 500 });
	}
};

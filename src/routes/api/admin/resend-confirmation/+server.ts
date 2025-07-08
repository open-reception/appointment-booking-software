import { json } from "@sveltejs/kit";
import { AdminAccountService } from "$lib/server/services/admin-account-service";
import { NotFoundError } from "$lib/server/utils/errors";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";

// Register OpenAPI documentation
registerOpenAPIRoute("/admin/resend-confirmation", "POST", {
	summary: "Resend confirmation email",
	description: "Resends the confirmation email to an admin account",
	tags: ["Admin"],
	requestBody: {
		description: "Admin email address",
		content: {
			"application/json": {
				schema: {
					type: "object",
					properties: {
						email: {
							type: "string",
							format: "email",
							description: "Admin's email address",
							example: "admin@example.com"
						}
					},
					required: ["email"]
				}
			}
		}
	},
	responses: {
		"200": {
			description: "Confirmation email resent successfully",
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
						message: "Confirmation email resent successfully. Please check your email."
					}
				}
			}
		},
		"404": {
			description: "No admin found with this email address",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" },
					example: { error: "No admin found with this email address" }
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

		// Resend confirmation email
		await AdminAccountService.resendConfirmationEmail(body.email);

		return json(
			{
				message: "Confirmation email resent successfully. Please check your email."
			},
			{ status: 200 }
		);
	} catch (error) {
		const log = logger.setContext("API");
		log.error("Resend confirmation error:", JSON.stringify(error || "?"));

		if (error instanceof NotFoundError) {
			return json({ error: "No admin found with this email address" }, { status: 404 });
		}

		return json({ error: "Internal server error" }, { status: 500 });
	}
};

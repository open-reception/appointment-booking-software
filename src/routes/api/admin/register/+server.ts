import { json } from "@sveltejs/kit";
import { AdminAccountService } from "$lib/server/services/admin-account-service";
import { ValidationError } from "$lib/server/utils/errors";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";

// Register OpenAPI documentation
registerOpenAPIRoute("/admin/register", "POST", {
	summary: "Register a new admin account",
	description: "Creates a new admin account that requires email confirmation",
	tags: ["Admin"],
	requestBody: {
		description: "Admin registration data",
		content: {
			"application/json": {
				schema: {
					type: "object",
					properties: {
						name: { type: "string", description: "Admin's full name", example: "Admin Name" },
						email: { type: "string", format: "email", description: "Admin's email address", example: "admin@example.com" }
					},
					required: ["name", "email"]
				}
			}
		}
	},
	responses: {
		"201": {
			description: "Admin account created successfully",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							message: { type: "string", description: "Success message" },
							adminId: { type: "string", description: "Generated admin ID" },
							email: { type: "string", description: "Admin's email address" }
						},
						required: ["message", "adminId", "email"]
					},
					example: {
						message: "Admin account created successfully. Please check your email for confirmation.",
						adminId: "01234567-89ab-cdef-0123-456789abcdef",
						email: "admin@example.com"
					}
				}
			}
		},
		"400": {
			description: "Invalid input data",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" },
					example: { error: "Invalid admin data" }
				}
			}
		},
		"409": {
			description: "Admin with this email already exists",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" },
					example: { error: "An admin with this email already exists" }
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

		const admin = await AdminAccountService.createAdmin({
			name: body.name,
			email: body.email
		});

		return json(
			{
				message: "Admin account created successfully. Please check your email for confirmation.",
				adminId: admin.id,
				email: admin.email
			},
			{ status: 201 }
		);
	} catch (error) {
		const log = logger.setContext("API");
		log.error("Admin registration error:", JSON.stringify(error || "?"));

		if (error instanceof ValidationError) {
			return json({ error: error.message }, { status: 400 });
		}

		// Handle unique constraint violation (email already exists)
		if (error instanceof Error && error.message.includes("unique constraint")) {
			return json({ error: "An admin with this email already exists" }, { status: 409 });
		}

		return json({ error: "Internal server error" }, { status: 500 });
	}
};

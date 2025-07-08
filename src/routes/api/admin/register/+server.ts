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
						email: {
							type: "string",
							format: "email",
							description: "Admin's email address",
							example: "admin@example.com"
						},
						passkey: {
							type: "object",
							description: "WebAuthn passkey data",
							properties: {
								id: { type: "string", description: "Credential ID from WebAuthn" },
								publicKey: { type: "string", description: "Base64 encoded public key" },
								counter: { type: "integer", description: "Signature counter", default: 0 },
								deviceName: { type: "string", description: "Device name for identification", example: "MacBook Pro" }
							},
							required: ["id", "publicKey"]
						}
					},
					required: ["name", "email", "passkey"]
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
						message:
							"Admin account created successfully. Please check your email for confirmation.",
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
	const log = logger.setContext("API");
	
	try {
		const body = await request.json();

		log.debug("Creating admin account with passkey", { 
			email: body.email, 
			passkeyId: body.passkey?.id,
			deviceName: body.passkey?.deviceName 
		});

		// Create admin account
		const admin = await AdminAccountService.createAdmin({
			name: body.name,
			email: body.email
		});

		// Add the passkey to the admin account
		await AdminAccountService.addPasskey(admin.id, {
			id: body.passkey.id,
			publicKey: body.passkey.publicKey,
			counter: body.passkey.counter || 0,
			deviceName: body.passkey.deviceName || "Unknown Device"
		});

		log.debug("Admin account and passkey created successfully", {
			adminId: admin.id,
			email: admin.email,
			passkeyId: body.passkey.id
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

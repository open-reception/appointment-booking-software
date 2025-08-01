import { json } from "@sveltejs/kit";
import { UserService } from "$lib/server/services/user-service";
import { ValidationError } from "$lib/server/utils/errors";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";

// Register OpenAPI documentation
registerOpenAPIRoute("/admin/init", "POST", {
	summary: "Register an initial admin account",
	description:
		"Creates an initial admin account that requires email confirmation. Authentication can be set up using either a WebAuthn passkey or a passphrase. Only works if no global admin account exists yet.",
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
							description: "WebAuthn passkey data (alternative to passphrase)",
							properties: {
								id: { type: "string", description: "Credential ID from WebAuthn" },
								publicKey: { type: "string", description: "Base64 encoded public key" },
								counter: { type: "integer", description: "Signature counter", default: 0 },
								deviceName: {
									type: "string",
									description: "Device name for identification",
									example: "MacBook Pro"
								}
							},
							required: ["id", "publicKey"]
						},
						passphrase: {
							type: "string",
							minLength: 12,
							description: "User passphrase (alternative to passkey, minimum 12 characters)",
							example: "MySecurePassphrase123"
						}
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
			description: "Admin account already exists",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" },
					example: { error: "An admin already exists" }
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

		if (await UserService.adminExists()) {
			return json({ error: "System was already initialized" }, { status: 409 });
		}

		// Validate that either passkey or passphrase is provided (but not both)
		const hasPasskey = !!body.passkey;
		const hasPassphrase = !!body.passphrase;

		if (!hasPasskey && !hasPassphrase) {
			return json({ error: "Either passkey or passphrase must be provided" }, { status: 400 });
		}

		if (hasPasskey && hasPassphrase) {
			return json({ error: "Cannot provide both passkey and passphrase" }, { status: 400 });
		}

		log.debug("Creating admin account", {
			email: body.email,
			authMethod: hasPasskey ? "passkey" : "passphrase",
			passkeyId: body.passkey?.id,
			deviceName: body.passkey?.deviceName
		});

		// Create admin account
		const admin = await UserService.createUser({
			name: body.name,
			email: body.email,
			passphrase: body.passphrase, // Will be undefined if passkey is used
			language: body.language || "de"
		});

		// Add the passkey to the admin account if provided
		if (hasPasskey) {
			await UserService.addPasskey(admin.id, {
				id: body.passkey.id,
				publicKey: body.passkey.publicKey,
				counter: body.passkey.counter || 0,
				deviceName: body.passkey.deviceName || "Unknown Device"
			});
		}

		log.debug("Admin account created successfully", {
			adminId: admin.id,
			email: admin.email,
			authMethod: hasPasskey ? "passkey" : "passphrase",
			passkeyId: hasPasskey ? body.passkey.id : undefined
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

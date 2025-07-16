import { json } from "@sveltejs/kit";
import { UserService } from "$lib/server/services/user-service";
import { ValidationError } from "$lib/server/utils/errors";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";

// Register OpenAPI documentation
registerOpenAPIRoute("/auth/register", "POST", {
	summary: "Register a new user account",
	description: "Creates a new user account that requires email confirmation",
	tags: ["Authentication"],
	requestBody: {
		description: "User registration data",
		content: {
			"application/json": {
				schema: {
					type: "object",
					properties: {
						name: { type: "string", description: "User's full name", example: "John Doe" },
						email: {
							type: "string",
							format: "email",
							description: "User's email address",
							example: "user@example.com"
						},
						role: {
							type: "string",
							enum: ["GLOBAL_ADMIN", "TENANT_ADMIN", "STAFF"],
							description: "User's role in the system",
							example: "STAFF"
						},
						tenantId: {
							type: "string",
							format: "uuid",
							description: "Tenant ID for TENANT_ADMIN and STAFF roles",
							example: "01234567-89ab-cdef-0123-456789abcdef"
						},
						passphrase: {
							type: "string",
							minLength: 12,
							description: "Optional passphrase for password authentication (min 12 chars)",
							example: "my-secure-passphrase-123"
						},
						passkey: {
							type: "object",
							description: "WebAuthn passkey data",
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
						}
					},
					required: ["name", "email", "role"]
				}
			}
		}
	},
	responses: {
		"201": {
			description: "User account created successfully",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							message: { type: "string", description: "Success message" },
							userId: { type: "string", description: "Generated user ID" },
							email: { type: "string", description: "User's email address" }
						},
						required: ["message", "userId", "email"]
					},
					example: {
						message: "User account created successfully. Please check your email for confirmation.",
						userId: "01234567-89ab-cdef-0123-456789abcdef",
						email: "user@example.com"
					}
				}
			}
		},
		"400": {
			description: "Invalid input data",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" },
					example: { error: "Invalid user data" }
				}
			}
		},
		"409": {
			description: "User with this email already exists",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" },
					example: { error: "A user with this email already exists" }
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

		// Validate that either passphrase or passkey is provided
		if (!body.passphrase && !body.passkey) {
			return json({ error: "Either passphrase or passkey must be provided" }, { status: 400 });
		}

		log.debug("Creating user account", {
			email: body.email,
			role: body.role,
			tenantId: body.tenantId,
			hasPassphrase: !!body.passphrase,
			passkeyId: body.passkey?.id,
			deviceName: body.passkey?.deviceName
		});

		// Create user account
		const user = await UserService.createUser({
			name: body.name,
			email: body.email,
			role: body.role,
			tenantId: body.tenantId,
			passphrase: body.passphrase
		});

		// Add the passkey to the user account if provided
		if (body.passkey) {
			await UserService.addPasskey(user.id, {
				id: body.passkey.id,
				publicKey: body.passkey.publicKey,
				counter: body.passkey.counter || 0,
				deviceName: body.passkey.deviceName || "Unknown Device"
			});
		}

		log.debug("User account and passkey created successfully", {
			userId: user.id,
			email: user.email,
			role: user.role,
			tenantId: user.tenantId,
			passkeyId: body.passkey.id
		});

		return json(
			{
				message: "User account created successfully. Please check your email for confirmation.",
				userId: user.id,
				email: user.email
			},
			{ status: 201 }
		);
	} catch (error) {
		log.error("User registration error:", JSON.stringify(error || "?"));

		if (error instanceof ValidationError) {
			return json({ error: error.message }, { status: 400 });
		}

		// Handle unique constraint violation (email already exists)
		if (error instanceof Error && error.message.includes("unique constraint")) {
			return json({ error: "A user with this email already exists" }, { status: 409 });
		}

		return json({ error: "Internal server error" }, { status: 500 });
	}
};

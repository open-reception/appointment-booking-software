import { json } from "@sveltejs/kit";
import { UserService } from "$lib/server/services/user-service";
import { WebAuthnService } from "$lib/server/auth/webauthn-service";
import { NotFoundError, ValidationError } from "$lib/server/utils/errors";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";

// Register OpenAPI documentation
registerOpenAPIRoute("/auth/passkeys", "POST", {
	summary: "Add additional WebAuthn passkey to user account",
	description: "Allows authenticated users to add additional WebAuthn keys to their accounts",
	tags: ["Authentication"],
	requestBody: {
		description: "WebAuthn passkey data",
		content: {
			"application/json": {
				schema: {
					type: "object",
					properties: {
						userId: {
							type: "string",
							format: "uuid",
							description: "User ID to add the passkey to",
							example: "01234567-89ab-cdef-0123-456789abcdef"
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
									example: "iPhone 15"
								}
							},
							required: ["id", "publicKey"]
						}
					},
					required: ["userId", "passkey"]
				}
			}
		}
	},
	responses: {
		"200": {
			description: "WebAuthn passkey added successfully",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							message: { type: "string", description: "Success message" },
							passkeyId: { type: "string", description: "ID of the added passkey" }
						},
						required: ["message", "passkeyId"]
					},
					example: {
						message: "WebAuthn passkey added successfully",
						passkeyId: "credential_id_123"
					}
				}
			}
		},
		"400": {
			description: "Invalid input data or user account not confirmed",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" },
					example: { error: "User account must be confirmed before adding additional passkeys" }
				}
			}
		},
		"404": {
			description: "User not found",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" },
					example: { error: "User not found" }
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

		// Validate required fields
		if (!body.userId || !body.passkey) {
			return json({ error: "userId and passkey are required" }, { status: 400 });
		}

		if (!body.passkey.id || !body.passkey.publicKey) {
			return json({ error: "Passkey must include id and publicKey" }, { status: 400 });
		}

		log.debug("Adding additional passkey to user", {
			userId: body.userId,
			passkeyId: body.passkey.id,
			deviceName: body.passkey.deviceName
		});

		// Extract counter from WebAuthn credential
		const counter = WebAuthnService.extractCounterFromCredential(body.passkey);

		// Add the passkey using the UserService
		await UserService.addAdditionalPasskey(body.userId, {
			id: body.passkey.id,
			userId: body.userId,
			publicKey: body.passkey.publicKey,
			counter,
			deviceName: body.passkey.deviceName || "Unknown Device"
		});

		log.debug("Additional passkey added successfully", {
			userId: body.userId,
			passkeyId: body.passkey.id
		});

		return json(
			{
				message: "WebAuthn passkey added successfully",
				passkeyId: body.passkey.id
			},
			{ status: 200 }
		);
	} catch (error) {
		log.error("Add passkey error:", JSON.stringify(error || "?"));

		if (error instanceof NotFoundError) {
			return json({ error: "User not found" }, { status: 404 });
		}

		if (error instanceof ValidationError) {
			return json({ error: error.message }, { status: 400 });
		}

		// Handle unique constraint violation (passkey already exists)
		if (error instanceof Error && error.message.includes("unique constraint")) {
			return json({ error: "This passkey is already registered" }, { status: 409 });
		}

		return json({ error: "Internal server error" }, { status: 500 });
	}
};

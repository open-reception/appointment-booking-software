import { json } from "@sveltejs/kit";
import { WebAuthnService } from "$lib/server/auth/webauthn-service";
import { UserService } from "$lib/server/services/user-service";
import { NotFoundError } from "$lib/server/utils/errors";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { UniversalLogger } from "$lib/logger";

const logger = new UniversalLogger().setContext("AuthChallengeAPI");

registerOpenAPIRoute("/auth/challenge", "POST", {
	summary: "Generate WebAuthn authentication challenge",
	description: "Generate a challenge for WebAuthn authentication and return registered passkeys",
	tags: ["Authentication"],
	requestBody: {
		description: "User email to generate challenge for",
		content: {
			"application/json": {
				schema: {
					type: "object",
					properties: {
						email: {
							type: "string",
							format: "email",
							description: "User's email address",
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
			description: "Challenge generated successfully",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							challenge: {
								type: "string",
								description: "Base64url encoded challenge"
							},
							allowCredentials: {
								type: "array",
								description: "List of registered passkeys for this user",
								items: {
									type: "object",
									properties: {
										id: { type: "string", description: "Credential ID" },
										type: { type: "string", enum: ["public-key"] },
										transports: {
											type: "array",
											items: { type: "string" },
											description: "Supported transports"
										}
									}
								}
							},
							timeout: {
								type: "number",
								description: "Timeout in milliseconds"
							}
						},
						required: ["challenge", "allowCredentials"]
					}
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

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const body = await request.json();

		logger.debug("Generating WebAuthn challenge", { email: body.email });

		// Get user by email
		let user;
		try {
			user = await UserService.getUserByEmail(body.email);
		} catch (error) {
			if (error instanceof NotFoundError) {
				return json({ error: "User not found" }, { status: 404 });
			}
			throw error;
		}

		// Generate challenge
		const challenge = WebAuthnService.generateChallenge();

		// Store challenge in session cookie (in production, use proper session storage)
		cookies.set("webauthn-challenge", challenge, {
			httpOnly: true,
			secure: true,
			sameSite: "strict",
			path: "/",
			maxAge: 60 * 5 // 5 minutes
		});

		// Get user's registered passkeys
		const passkeys = await WebAuthnService.getUserPasskeys(user.id);

		// Format passkeys for WebAuthn API
		const allowCredentials = passkeys.map((passkey) => ({
			id: passkey.id,
			type: "public-key" as const,
			transports: ["usb", "nfc", "ble", "internal"] // All possible transports
		}));

		logger.debug("WebAuthn challenge generated", {
			userId: user.id,
			email: user.email,
			passkeyCount: passkeys.length,
			challenge: challenge.substring(0, 8) + "..."
		});

		return json({
			challenge,
			allowCredentials,
			timeout: 60000, // 60 seconds
			rpId: "localhost", // TODO: Configure for production
			userVerification: "preferred"
		});
	} catch (error) {
		logger.error("Challenge generation error", { error: String(error) });
		return json({ error: "Internal server error" }, { status: 500 });
	}
};
import { json } from "@sveltejs/kit";
import { WebAuthnService } from "$lib/server/auth/webauthn-service";
import { UserService } from "$lib/server/services/user-service";
import { NotFoundError } from "$lib/server/utils/errors";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { UniversalLogger } from "$lib/logger";
import { env } from "$env/dynamic/private";

const logger = new UniversalLogger().setContext("AuthChallengeAPI");

registerOpenAPIRoute("/auth/challenge", "POST", {
	summary: "Generate WebAuthn authentication challenge",
	description: "Generate a challenge for WebAuthn authentication (login) or registration and return registered passkeys if user exists",
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
			description: "Challenge generated successfully for login or registration",
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
								description: "List of registered passkeys for this user (empty for registration)",
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
							},
							isRegistration: {
								type: "boolean",
								description: "True if this is for user registration (user not found)"
							}
						},
						required: ["challenge", "allowCredentials"]
					}
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

/**
 * Get the appropriate rpId (Relying Party ID) for WebAuthn based on environment
 */
function getRpId(requestUrl: URL): string {
	if (env.NODE_ENV === "production") {
		// In production, use the hostname (without subdomain for main domain)
		const hostname = requestUrl.hostname;
		const parts = hostname.split('.');
		
		// If it's a subdomain (e.g., tenant.example.com), use the main domain (example.com)
		// This allows passkeys to work across all subdomains
		if (parts.length > 2) {
			return parts.slice(-2).join('.');
		}
		return hostname;
	}
	
	// Development: use localhost
	return "localhost";
}

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	try {
		const body = await request.json();

		logger.debug("Generating WebAuthn challenge", { email: body.email });

		// Try to get user by email - but don't fail if not found
		let user = null;
		let isRegistration = false;
		
		try {
			user = await UserService.getUserByEmail(body.email);
		} catch (error) {
			if (error instanceof NotFoundError) {
				// User doesn't exist yet - this is a registration flow
				isRegistration = true;
				logger.debug("User not found - generating challenge for registration", { email: body.email });
			} else {
				throw error;
			}
		}

		// Generate challenge
		const challenge = WebAuthnService.generateChallenge();

		if (isRegistration) {
			// For registration, only store the email for validation
			cookies.set("webauthn-registration-email", body.email, {
				httpOnly: true,
				secure: true,
				sameSite: "strict",
				path: "/",
				maxAge: 60 * 5 // 5 minutes
			});
		} else {
			// For login, store the challenge for signature verification
			cookies.set("webauthn-challenge", challenge, {
				httpOnly: true,
				secure: true,
				sameSite: "strict",
				path: "/",
				maxAge: 60 * 5 // 5 minutes
			});
		}

		let allowCredentials: Array<{
			id: string;
			type: "public-key";
			transports: string[];
		}> = [];
		
		if (user) {
			// Get user's registered passkeys for login
			const passkeys = await WebAuthnService.getUserPasskeys(user.id);
			
			// Format passkeys for WebAuthn API
			allowCredentials = passkeys.map((passkey) => ({
				id: passkey.id,
				type: "public-key" as const,
				transports: ["usb", "nfc", "ble", "internal"] // All possible transports
			}));

			logger.debug("WebAuthn challenge generated for login", {
				userId: user.id,
				email: user.email,
				passkeyCount: passkeys.length,
				challenge: challenge.substring(0, 8) + "..."
			});
		} else {
			logger.debug("WebAuthn challenge generated for registration", {
				email: body.email,
				challenge: challenge.substring(0, 8) + "..."
			});
		}

		const rpId = getRpId(url);
		
		return json({
			challenge,
			allowCredentials,
			timeout: 60000, // 60 seconds
			rpId,
			userVerification: "preferred",
			isRegistration
		});
	} catch (error) {
		logger.error("Challenge generation error", { error: String(error) });
		return json({ error: "Internal server error" }, { status: 500 });
	}
};

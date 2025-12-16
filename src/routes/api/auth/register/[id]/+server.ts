import { json } from "@sveltejs/kit";
import { UserService } from "$lib/server/services/user-service";
import { WebAuthnService } from "$lib/server/auth/webauthn-service";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
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
                  example: "MacBook Pro",
                },
              },
              required: ["id", "publicKey"],
            },
          },
          required: ["name", "email"],
        },
      },
    },
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
              email: { type: "string", description: "User's email address" },
            },
            required: ["message", "userId", "email"],
          },
          example: {
            message: "User account created successfully. Please check your email for confirmation.",
            userId: "01234567-89ab-cdef-0123-456789abcdef",
            email: "user@example.com",
          },
        },
      },
    },
    "400": {
      description: "Invalid input data",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "Invalid user data" },
        },
      },
    },
    "409": {
      description: "User with this email already exists",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "A user with this email already exists" },
        },
      },
    },
    "500": {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "Internal server error" },
        },
      },
    },
  },
});

export const POST: RequestHandler = async ({ params, cookies, request }) => {
  const log = logger.setContext("API");

  try {
    const body = await request.json();
    const userId = params.id;

    if (!userId) {
      throw new ValidationError("User ID is required in the URL");
    }

    // Validate that either passphrase or passkey is provided
    if (!body.passkey) {
      throw new ValidationError("Passphrase must be provided");
    }

    // Add the passkey to the user account if provided
    // Validate that this registration was preceded by a challenge request
    const registrationEmail = cookies.get("webauthn-registration-email");

    // Challenge can come from:
    // 1. Request body (for tenant admins with PRF - second challenge overwrites cookie)
    // 2. Cookie (for global admins without PRF - only one challenge)
    const challengeFromSession = body.challenge || cookies.get("webauthn-challenge");

    if (!registrationEmail || registrationEmail !== body.email) {
      throw new ValidationError("Invalid or missing registration challenge cookie");
    }

    if (!challengeFromSession) {
      throw new ValidationError("Invalid or missing WebAuthn challenge");
    }

    log.debug("Using challenge for verification", {
      challengeSource: body.challenge ? "request body" : "cookie",
      challengePreview: challengeFromSession.substring(0, 20) + "...",
    });

    // Note: Cookie is not deleted here to allow subsequent crypto key storage.
    // It will expire automatically after 5 minutes (set in /api/auth/challenge)

    // Verify registration and extract COSE public key
    const verificationResult = await WebAuthnService.verifyRegistration(
      body.passkey.id,
      body.passkey.attestationObject,
      body.passkey.clientDataJSON,
      challengeFromSession,
    );

    await UserService.addPasskey(userId, {
      id: verificationResult.credentialID,
      publicKey: verificationResult.credentialPublicKey,
      counter: verificationResult.counter,
      deviceName: body.passkey.deviceName || "Unknown Device",
    });

    log.debug("Passkey added to user account", {
      userId: userId,
      passkeyId: verificationResult.credentialID,
      counter: verificationResult.counter,
    });

    return json(
      {
        message: "User account now has a passkey.",
      },
      { status: 201 },
    );
  } catch (error) {
    logError(log)("User registration error", error);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};

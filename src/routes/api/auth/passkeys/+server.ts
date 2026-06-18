import { json } from "@sveltejs/kit";
import { UserService } from "$lib/server/services/user-service";
import { WebAuthnService } from "$lib/server/auth/webauthn-service";
import { AuthenticationError, BackendError, ValidationError } from "$lib/server/utils/errors";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { checkPermission } from "$lib/server/utils/permissions";
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
                  example: "iPhone 15",
                },
              },
              required: ["id", "publicKey"],
            },
          },
          required: ["passkey"],
        },
      },
    },
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
              passkeyId: { type: "string", description: "ID of the added passkey" },
            },
            required: ["message", "passkeyId"],
          },
          example: {
            message: "WebAuthn passkey added successfully",
            passkeyId: "credential_id_123",
          },
        },
      },
    },
    "400": {
      description: "Invalid input data or user account not confirmed",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "User account must be confirmed before adding additional passkeys" },
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

export const POST: RequestHandler = async ({ request, locals, cookies, url }) => {
  const log = logger.setContext("API");

  try {
    const body = await request.json();

    if (!locals.user) {
      throw new AuthenticationError();
    }
    checkPermission(locals, locals.user.tenantId, false, false);

    const challenge = cookies.get("webauthn-challenge");
    if (!challenge) {
      throw new ValidationError("Missing registration challenge");
    }

    // Validate required fields
    if (!body.passkey) {
      throw new ValidationError("passkey is required");
    } else if (!body.passkey.id || !body.passkey.publicKey) {
      throw new ValidationError("Passkey must include id and publicKey");
    }

    log.debug("Adding additional passkey to user", {
      userId: locals.user.id,
      passkeyId: body.passkey.id,
      deviceName: body.passkey.deviceName,
    });

    const verified = await WebAuthnService.verifyRegistration(
      body.passkey.id,
      body.passkey.attestationObject,
      body.passkey.clientDataJSON,
      challenge,
      url,
    );

    // Add the passkey using the UserService
    await UserService.addAdditionalPasskey(locals.user.id, {
      id: verified.credentialID,
      userId: locals.user.id,
      publicKey: verified.credentialPublicKey,
      counter: verified.counter,
      deviceName: body.passkey.deviceName || "Unknown Device",
    });

    log.debug("Additional passkey added successfully", {
      userId: locals.user.id,
      passkeyId: body.passkey.id,
    });

    return json(
      {
        message: "WebAuthn passkey added successfully",
        passkeyId: body.passkey.id,
      },
      { status: 200 },
    );
  } catch (error) {
    log.error("Add passkey error:", JSON.stringify(error || "?"));

    // Handle unique constraint violation (passkey already exists)
    if (error instanceof Error && error.message.includes("unique constraint")) {
      return json({ error: "This passkey is already registered" }, { status: 409 });
    }

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return json({ error: "Internal server error" }, { status: 500 });
  }
};

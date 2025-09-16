import { json } from "@sveltejs/kit";
import { UserService } from "$lib/server/services/user-service";
import { WebAuthnService } from "$lib/server/auth/webauthn-service";
import {
  BackendError,
  ConflictError,
  InternalError,
  logError,
  ValidationError,
} from "$lib/server/utils/errors";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { ERRORS } from "$lib/errors";

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
              example: "admin@example.com",
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
                  example: "MacBook Pro",
                },
              },
              required: ["id", "publicKey"],
            },
            passphrase: {
              type: "string",
              minLength: 12,
              description: "User passphrase (alternative to passkey, minimum 12 characters)",
              example: "MySecurePassphrase123",
            },
          },
          required: ["name", "email"],
        },
      },
    },
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
              email: { type: "string", description: "Admin's email address" },
            },
            required: ["message", "adminId", "email"],
          },
          example: {
            message:
              "Admin account created successfully. Please check your email for confirmation.",
            adminId: "01234567-89ab-cdef-0123-456789abcdef",
            email: "admin@example.com",
          },
        },
      },
    },
    "400": {
      description: "Invalid input data",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "Invalid admin data" },
        },
      },
    },
    "409": {
      description: "Admin account already exists",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "An admin already exists" },
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

export const POST: RequestHandler = async ({ request, cookies, url }) => {
  const log = logger.setContext("API");

  try {
    const body = await request.json();

    if (await UserService.adminExists()) {
      throw new ConflictError(ERRORS.USERS.ADMIN_EXISTS);
    }

    // Validate that either passkey or passphrase is provided (but not both)
    const hasPasskey = !!body.passkey;
    const hasPassphrase = !!body.passphrase;

    if (!hasPasskey && !hasPassphrase) {
      throw new ValidationError(ERRORS.SECURITY.EITHER_PASSKEY_OR_PHRASE);
    }

    if (hasPasskey && hasPassphrase) {
      throw new ValidationError(ERRORS.SECURITY.BOTH_PASSKEY_AND_PHRASE);
    }

    log.debug("Creating admin account", {
      email: body.email,
      authMethod: hasPasskey ? "passkey" : "passphrase",
      passkeyId: body.passkey?.id,
      deviceName: body.passkey?.deviceName,
    });

    // Create admin account
    const admin = await UserService.createUser(
      {
        name: body.name,
        email: body.email,
        passphrase: body.passphrase, // Will be undefined if passkey is used
        language: body.language || "de",
      },
      url,
    );

    // Add the passkey to the admin account if provided
    if (hasPasskey) {
      // Validate that this registration was preceded by a challenge request
      const registrationEmail = cookies.get("webauthn-registration-email");

      if (!registrationEmail || registrationEmail !== body.email) {
        throw new ValidationError(ERRORS.SECURITY.INVALID_PASSKEY_REGISTRATION);
      }

      // Clear the registration cookie after validation (challenge cookie is cleared by login route)
      cookies.delete("webauthn-registration-email", { path: "/" });

      // Extract counter from WebAuthn credential
      const counter = WebAuthnService.extractCounterFromCredential(body.passkey);

      await UserService.addPasskey(admin.id, {
        id: body.passkey.id,
        publicKey: body.passkey.publicKey,
        counter,
        deviceName: body.passkey.deviceName || "Unknown Device",
      });

      log.debug("Passkey added to admin account", {
        adminId: admin.id,
        passkeyId: body.passkey.id,
      });
    }

    log.debug("Admin account created successfully", {
      adminId: admin.id,
      email: admin.email,
      authMethod: hasPasskey ? "passkey" : "passphrase",
      passkeyId: hasPasskey ? body.passkey.id : undefined,
    });

    return json(
      {
        message: "Admin account created successfully. Please check your email for confirmation.",
        adminId: admin.id,
        email: admin.email,
      },
      { status: 201 },
    );
  } catch (error) {
    logError(log)("Admin registration error", error);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    // Handle unique constraint violation (email already exists)
    if (error instanceof Error && error.message.includes("unique constraint")) {
      return new ConflictError("An admin with this email already exists").toJson();
    }

    return new InternalError().toJson();
  }
};

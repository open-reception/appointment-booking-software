/**
 * API Route: Store Staff Cryptographic Keys
 *
 * Called by the browser after passkey registration to store:
 * - Public key (for encryption by others)
 * - Private key shard (database portion of split key)
 * - Associated passkey ID
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { StaffCryptoService } from "$lib/server/services/staff-crypto.service";
import { logger } from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";
import {
  BackendError,
  ValidationError,
  AuthorizationError,
  InternalError,
  logError,
} from "$lib/server/utils/errors";
import { z } from "zod";
import { registerOpenAPIRoute } from "$lib/server/openapi";

// Register OpenAPI documentation
registerOpenAPIRoute("/tenants/{id}/staff/{staffId}/crypto", "POST", {
  summary: "Store staff cryptographic keys",
  description:
    "Stores the browser-generated cryptographic keys for a staff member after passkey registration. Can be called during passkey registration (with registration cookie) or when authenticated.",
  tags: ["Staff", "Cryptography"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Tenant ID",
    },
    {
      name: "staffId",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Staff member ID",
    },
  ],
  requestBody: {
    description: "Cryptographic key data",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            passkeyId: {
              type: "string",
              description: "WebAuthn credential ID from passkey registration",
            },
            publicKey: {
              type: "string",
              description: "Base64-encoded ML-KEM-768 public key",
            },
            privateKeyShare: {
              type: "string",
              description: "Base64-encoded database shard of private key",
            },
            email: {
              type: "string",
              format: "email",
              description: "Email address for cookie validation during registration",
            },
          },
          required: ["passkeyId", "publicKey", "privateKeyShare", "email"],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Keys stored successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    "400": {
      description: "Invalid input data",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "403": {
      description: "Unauthorized - can only store own keys",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "500": {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
  },
});

const requestSchema = z.object({
  passkeyId: z.string().min(1, "Passkey ID is required"),
  publicKey: z.string().min(1, "Public key is required"),
  privateKeyShare: z.string().min(1, "Private key share is required"),
  email: z.string().email("Valid email is required").optional(), // Required for cookie validation
});

export const POST: RequestHandler = async ({ params, locals, request, cookies }) => {
  const log = logger.setContext("API.StoreStaffCrypto");
  const { id: tenantId, staffId } = params;

  try {
    if (!tenantId || !staffId) {
      throw new ValidationError("Tenant ID and Staff ID are required");
    }

    // Parse and validate request body first (needed for both auth methods)
    const body = await request.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      console.error("Validation error:", validation.error.issues);
      throw new ValidationError(
        "Invalid request data: " + validation.error.issues.map((e) => e.message).join(", "),
      );
    }

    const { passkeyId, publicKey, privateKeyShare, email } = validation.data;

    // Authentication: Accept either active session OR registration cookie
    const isAuthenticated = locals.user && locals.user.userId === staffId;
    const registrationEmail = cookies.get("webauthn-registration-email");
    const isRegistration = registrationEmail === email;

    if (!isAuthenticated && !isRegistration) {
      log.warn("Unauthorized crypto key storage attempt", {
        tenantId,
        staffId,
        requesterId: locals.user?.userId,
        hasRegistrationCookie: !!registrationEmail,
        emailsMatch: registrationEmail === email,
      });
    }

    // For authenticated users, verify tenant access
    if (isAuthenticated) {
      checkPermission(locals, tenantId, false);
    }

    log.debug("Storing staff crypto keys", { tenantId, staffId, passkeyId });

    // Store the keys
    const staffCryptoService = new StaffCryptoService();
    await staffCryptoService.storeStaffKeypair(
      tenantId,
      staffId,
      passkeyId,
      publicKey,
      privateKeyShare,
    );

    log.info("Staff crypto keys stored successfully", {
      tenantId,
      staffId,
      passkeyId,
    });

    return json({
      success: true,
      message: "Cryptographic keys stored successfully",
    });
  } catch (error) {
    logError(log)("Failed to store staff crypto keys", error, locals.user?.userId, params.id);
    log.error("Additional context", { tenantId, staffId });

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};

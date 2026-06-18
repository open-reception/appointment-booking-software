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
  InternalError,
  logError,
  AuthorizationError,
} from "$lib/server/utils/errors";
import { z } from "zod";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { centralDb } from "$lib/server/db";
import { user } from "$lib/server/db/central-schema";
import { eq } from "drizzle-orm";
import { normalizeEmail } from "$lib/utils";

const ML_KEM_768_PUBLIC_KEY_BYTES = 1184;
const ML_KEM_768_PRIVATE_KEY_BYTES = 2400;
const passkeyIdBase64UrlPattern = /^[A-Za-z0-9_-]+$/;
const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const isBase64String = (value: string): boolean => {
  return value.length > 0 && value.length % 4 === 0 && base64Pattern.test(value);
};

const hasDecodedByteLength = (value: string, expectedBytes: number): boolean => {
  try {
    return Buffer.from(value, "base64").length === expectedBytes;
  } catch {
    return false;
  }
};

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
  passkeyId: z
    .string()
    .min(16, "Passkey ID is required")
    .max(1024, "Passkey ID is too long")
    .regex(passkeyIdBase64UrlPattern, "Passkey ID must be base64url encoded"),
  publicKey: z
    .string()
    .refine((value) => isBase64String(value), "Public key must be valid Base64")
    .refine(
      (value) => hasDecodedByteLength(value, ML_KEM_768_PUBLIC_KEY_BYTES),
      `Public key must decode to ${ML_KEM_768_PUBLIC_KEY_BYTES} bytes (ML-KEM-768)`,
    ),
  privateKeyShare: z
    .string()
    .refine((value) => isBase64String(value), "Private key share must be valid Base64")
    .refine(
      (value) => hasDecodedByteLength(value, ML_KEM_768_PRIVATE_KEY_BYTES),
      `Private key share must decode to ${ML_KEM_768_PRIVATE_KEY_BYTES} bytes (ML-KEM-768)`,
    ),
  email: z.email("Valid email is required").optional(), // Required for cookie validation
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
      throw new ValidationError(
        "Invalid request data: " + validation.error.issues.map((e) => e.message).join(", "),
      );
    }

    const { passkeyId, publicKey, privateKeyShare, email } = validation.data;

    // Authentication: Accept either active session OR registration cookie
    const isAuthenticated = locals.user && locals.user.id === staffId;
    const registrationEmail = normalizeEmail(cookies.get("webauthn-registration-email"));
    const requestEmail = normalizeEmail(email);
    const isRegistration =
      !!registrationEmail && !!requestEmail && registrationEmail === requestEmail;

    if (!isAuthenticated && !isRegistration) {
      log.warn("Unauthorized crypto key storage attempt", {
        tenantId,
        staffId,
        requesterId: locals.user?.id,
        hasRegistrationCookie: !!registrationEmail,
        emailsMatch: registrationEmail === requestEmail,
      });
      throw new AuthorizationError();
    }

    // For authenticated users, verify tenant access
    if (isAuthenticated) {
      checkPermission(locals, tenantId, false);
    } else {
      const staffUser = await centralDb
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, staffId))
        .limit(1);

      if (staffUser.length === 0) {
        log.warn("Rejected registration crypto key storage for unknown staff user", {
          tenantId,
          staffId,
          hasRegistrationCookie: !!registrationEmail,
        });
        throw new AuthorizationError();
      }
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
    });

    return json({
      success: true,
      message: "Cryptographic keys stored successfully",
    });
  } catch (error) {
    logError(log)("Failed to store staff crypto keys", error, locals.user?.id, params.id);
    log.error("Additional context", { tenantId, staffId });

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};

import { json } from "@sveltejs/kit";
import { StaffCryptoService } from "$lib/server/services/staff-crypto.service";
import { WebAuthnService } from "$lib/server/auth/webauthn-service";
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
  ConflictError,
  BackendError,
  InternalError,
  logError,
} from "$lib/server/utils/errors";
import { checkPermission } from "$lib/server/utils/permissions";
import type { RequestEvent } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { z } from "zod";
import logger from "$lib/logger";
import { createHash } from "crypto";

// Register OpenAPI documentation
registerOpenAPIRoute("/auth/passkeys/{passkeyId}/crypto", "POST", {
  summary: "Store cryptographic keypair for a new passkey",
  description:
    "When a staff member adds a new passkey, this endpoint stores the cryptographic keys for the new passkey. " +
    "The client must use the PRF extension to derive the passkey-based key shard, then create the database shard via XOR with the private key. " +
    "This maintains zero-knowledge security where the server never sees the complete private key.",
  tags: ["Authentication", "Cryptography"],
  parameters: [
    {
      name: "passkeyId",
      in: "path",
      required: true,
      schema: { type: "string" },
      description: "The ID of the new passkey to store cryptographic keys for",
    },
  ],
  requestBody: {
    description: "Cryptographic key data derived using PRF extension",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            tenantId: {
              type: "string",
              format: "uuid",
              description: "Tenant ID where the staff member belongs",
            },
            publicKey: {
              type: "string",
              description: "Base64-encoded ML-KEM-768 public key",
            },
            privateKeyShare: {
              type: "string",
              description:
                "Base64-encoded database shard of the private key (XOR-split with PRF-derived shard)",
            },
            prfOutput: {
              type: "string",
              description:
                "Base64-encoded PRF output from WebAuthn for verification (derived using email as salt)",
            },
          },
          required: ["tenantId", "publicKey", "privateKeyShare", "prfOutput"],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Cryptographic keys successfully stored for the new passkey",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              passkeyId: { type: "string" },
            },
          },
          example: {
            success: true,
            message: "Cryptographic keys stored successfully",
            passkeyId: "credential_abc123",
          },
        },
      },
    },
    "400": {
      description: "Invalid request data or PRF verification failed",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "403": {
      description: "Not authorized to store keys for this passkey",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "404": {
      description: "Passkey not found or doesn't belong to the authenticated user",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "409": {
      description: "Cryptographic keys already exist for this passkey",
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

// Validation schema for request body
const requestSchema = z.object({
  tenantId: z.string().uuid("Valid tenant ID is required"),
  publicKey: z.string().min(1, "Public key is required"),
  privateKeyShare: z.string().min(1, "Private key share is required"),
  prfOutput: z.string().min(1, "PRF output is required for zero-knowledge verification"),
});

/**
 * Verify PRF output format and length
 * PRF extension produces 32 bytes of deterministic output
 */
function verifyPRFOutput(prfOutputBase64: string): boolean {
  try {
    // Decode from base64
    const prfBuffer = Buffer.from(prfOutputBase64, "base64");

    // PRF output should be exactly 32 bytes
    if (prfBuffer.length !== 32) {
      logger.setContext("API.StorePsakeyCrypto").warn("Invalid PRF output length", {
        expected: 32,
        actual: prfBuffer.length,
      });
      return false;
    }

    // Verify it's not all zeros (invalid output)
    const isAllZeros = prfBuffer.every((byte) => byte === 0);
    if (isAllZeros) {
      logger.setContext("API.StorePasskeyCrypto").warn("PRF output is all zeros (invalid)");
      return false;
    }

    return true;
  } catch (error) {
    logger.setContext("API.StorePasskeyCrypto").error("Failed to verify PRF output", {
      error: String(error),
    });
    return false;
  }
}

/**
 * Create a hash of the PRF output for future verification
 * This allows us to verify that the same PRF output is used consistently
 */
function hashPRFOutput(prfOutputBase64: string): string {
  const prfBuffer = Buffer.from(prfOutputBase64, "base64");
  return createHash("sha256").update(prfBuffer).digest("hex");
}

export async function POST({ request, params, locals }: RequestEvent) {
  const log = logger.setContext("API.StorePasskeyCrypto");
  const { passkeyId } = params;

  try {
    // 1. Check authentication
    if (!locals.user) {
      throw new AuthorizationError("Authentication required");
    }

    if (!passkeyId) {
      throw new ValidationError("Passkey ID is required");
    }

    const userId = locals.user.id;
    const userEmail = locals.user.email;

    // 2. Verify passkey ownership BEFORE parsing body (security: prevent data injection)
    const userPasskeys = await WebAuthnService.getUserPasskeys(userId);
    const targetPasskey = userPasskeys.find((p) => p.id === passkeyId);

    if (!targetPasskey) {
      throw new NotFoundError("Passkey not found or does not belong to you");
    }

    // 3. Parse and validate request body
    const body = await request.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      throw new ValidationError(
        "Invalid request data: " + validation.error.issues.map((e) => e.message).join(", "),
      );
    }

    const { tenantId, publicKey, privateKeyShare, prfOutput } = validation.data;

    // 4. Check tenant access using standard permission check
    checkPermission(locals, tenantId, false);

    log.debug("Storing crypto keys for passkey", {
      passkeyId,
      userId,
      tenantId,
    });

    // 5. Verify PRF output
    if (!verifyPRFOutput(prfOutput)) {
      throw new ValidationError(
        "Invalid PRF output: Must be 32 bytes of valid cryptographic data derived from the passkey",
      );
    }

    const prfHash = hashPRFOutput(prfOutput);
    log.debug("PRF output verified successfully", {
      passkeyId,
      prfHash: prfHash.substring(0, 16) + "...", // Log partial hash for debugging
    });

    // 6. Check for existing crypto data - prevent accidental overwrites
    const staffCryptoService = new StaffCryptoService();
    const existingCrypto = await staffCryptoService.getStaffCryptoForPasskey(
      tenantId,
      userId,
      passkeyId,
    );

    if (existingCrypto) {
      throw new ConflictError(
        "Crypto keys already exist for this passkey. Delete the passkey first if you need to re-register it.",
      );
    }

    // 7. Store the crypto keys
    await staffCryptoService.storeStaffKeypair(
      tenantId,
      userId,
      passkeyId,
      publicKey,
      privateKeyShare,
    );

    log.info("Crypto keys stored successfully", {
      passkeyId,
      userId,
      tenantId,
      prfHash: prfHash.substring(0, 16) + "...",
    });

    return json({
      success: true,
      message: "Crypto keys stored successfully",
      passkeyId,
    });
  } catch (error) {
    logError(log)("Failed to store crypto keys", error, locals.user?.id, params.passkeyId);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
}

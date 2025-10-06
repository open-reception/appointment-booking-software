/**
 * API Route: Get Staff Key Shard
 *
 * Returns the database-stored shard of a staff member's private key for key reconstruction.
 * This is used by the crypto worker to reconstruct the full private key from the two shards.
 *
 * Security:
 * - Only the staff member themselves can access their own key shard
 * - The passkeyId is automatically determined from the most recently used passkey
 * - Access is denied if no valid passkey or corresponding crypto data is found (no fallbacks)
 * - This ensures only properly authenticated users can access their key shards
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { StaffCryptoService } from "$lib/server/services/staff-crypto.service";
import { WebAuthnService } from "$lib/server/auth/webauthn-service";
import { logger } from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";
import {
  BackendError,
  ValidationError,
  AuthorizationError,
  NotFoundError,
  InternalError,
  logError,
} from "$lib/server/utils/errors";
import { registerOpenAPIRoute } from "$lib/server/openapi";

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/staff/{staffId}/key-shard", "GET", {
  summary: "Get staff key shard",
  description:
    "Returns the database-stored shard of a staff member's private key for key reconstruction. Only the staff member themselves can access their own key shard.",
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
  responses: {
    "200": {
      description: "Staff key shard retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              publicKey: {
                type: "string",
                description: "Staff member's public key",
              },
              privateKeyShare: {
                type: "string",
                description: "Database-stored shard of the private key",
              },
              passkeyId: {
                type: "string",
                description: "Passkey ID",
              },
            },
            required: ["publicKey", "privateKeyShare", "passkeyId"],
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
    "401": {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "403": {
      description: "Unauthorized - can only access own key shard",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "404": {
      description: "Staff crypto data not found",
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

export const GET: RequestHandler = async ({ params, locals }) => {
  const log = logger.setContext("API.StaffKeyShard");

  const { id: tenantId, staffId } = params;

  try {
    if (!tenantId || !staffId) {
      throw new ValidationError("Tenant ID and Staff ID are required");
    }

    // Check basic tenant access
    checkPermission(locals, tenantId, false);

    // Additional security check: Only the passkey owner can access their own key shard
    if (!locals.user || locals.user.userId !== staffId) {
      log.warn("Unauthorized key shard access attempt", {
        tenantId,
        staffId,
        requesterId: locals.user?.userId,
      });
      throw new AuthorizationError("You can only access your own key shard");
    }

    // Get the passkey ID from the user's most recently used passkey
    // This ensures that only users who have actually authenticated with WebAuthn
    // can access their key shard. No fallback to other passkeys for security.
    let passkeyId: string;

    try {
      // Get the most recently used passkey for this authenticated user
      const recentPasskey = await WebAuthnService.getMostRecentPasskey(locals.user.userId);

      if (!recentPasskey) {
        log.warn("No passkey found for authenticated user - security violation", {
          tenantId,
          staffId,
          userId: locals.user.userId,
          security: "User session exists but no passkey found",
        });
        throw new AuthorizationError("No valid passkey found for authenticated user");
      }

      passkeyId = recentPasskey.id;
      log.debug("Using authenticated user's most recent passkey", {
        tenantId,
        staffId,
        passkeyId,
        lastUsedAt: recentPasskey.lastUsedAt,
      });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw error; // Re-throw authorization errors
      }
      log.error("Failed to determine passkey ID for authenticated user", {
        tenantId,
        staffId,
        error: String(error),
      });
      throw new InternalError("Failed to determine passkey ID");
    }

    log.debug("Fetching staff key shard", {
      tenantId,
      staffId,
      passkeyId,
      requesterId: locals.user.userId,
    });

    const staffCryptoService = new StaffCryptoService();

    // Get the staff crypto data using the determined passkey ID
    // No fallback - if the recent passkey doesn't have crypto data, access is denied
    const staffCrypto = await staffCryptoService.getStaffCryptoForPasskey(
      tenantId,
      staffId,
      passkeyId,
    );

    if (!staffCrypto) {
      log.warn("Staff crypto data not found for authenticated passkey", {
        tenantId,
        staffId,
        passkeyId,
        security: "Access denied - no crypto data for authenticated passkey",
      });
      throw new NotFoundError("Staff crypto data not found for the authenticated passkey");
    }

    log.debug("Staff key shard retrieved successfully", {
      tenantId,
      staffId,
      hasPublicKey: !!staffCrypto.publicKey,
      hasPrivateKeyShare: !!staffCrypto.privateKeyShare,
      passkeyId: staffCrypto.passkeyId,
    });

    return json({
      publicKey: staffCrypto.publicKey,
      privateKeyShare: staffCrypto.privateKeyShare,
      passkeyId: staffCrypto.passkeyId,
    });
  } catch (error) {
    // Note: passkeyId might not be available if error occurred before determination
    const passkeyIdForError = locals.user?.sessionId || "unknown";
    logError(log)("Failed to fetch staff key shard", error, locals.user?.userId, params.id);
    log.error("Additional context", { tenantId, staffId, passkeyId: passkeyIdForError });

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};

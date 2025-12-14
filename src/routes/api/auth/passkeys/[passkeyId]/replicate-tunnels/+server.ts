import { json } from "@sveltejs/kit";
import { StaffCryptoService } from "$lib/server/services/staff-crypto.service";
import { WebAuthnService } from "$lib/server/auth/webauthn-service";
import { AuthorizationError, NotFoundError, ValidationError } from "$lib/server/utils/errors";
import type { RequestEvent } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";

// Register OpenAPI documentation
registerOpenAPIRoute("/auth/passkeys/{passkeyId}/replicate-tunnels", "POST", {
  summary: "Replicate encrypted tunnel keys to a new passkey",
  description:
    "When a staff member adds a new passkey, this endpoint stores the re-encrypted tunnel keys for the new passkey. " +
    "The client must first decrypt existing tunnels with the current passkey, then re-encrypt them with the new passkey.",
  tags: ["Authentication", "Cryptography"],
  parameters: [
    {
      name: "passkeyId",
      in: "path",
      required: true,
      schema: { type: "string" },
      description: "The ID of the new passkey to replicate tunnels for",
    },
  ],
  requestBody: {
    description: "Re-encrypted tunnel keys for the new passkey",
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
              description: "Base64-encoded Kyber public key for the new passkey",
            },
            privateKeyShare: {
              type: "string",
              description:
                "Base64-encoded database shard of the private key (XOR-split with passkey-based shard)",
            },
          },
          required: ["tenantId", "publicKey", "privateKeyShare"],
        },
      },
    },
  },
  responses: {
    "201": {
      description: "Tunnel keys successfully replicated to the new passkey",
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
            message: "Tunnel keys replicated successfully",
            passkeyId: "credential_abc123",
          },
        },
      },
    },
    "400": {
      description: "Invalid request data",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "403": {
      description: "Not authorized to replicate tunnels for this passkey",
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

export async function POST({ request, params, locals }: RequestEvent) {
  const log = logger.setContext("API");
  const { passkeyId } = params;

  try {
    // Check authentication
    if (!locals.user) {
      throw new AuthorizationError("Authentication required");
    }

    if (!passkeyId) {
      throw new ValidationError("Passkey ID is required");
    }

    const userId = locals.user.userId;

    // Parse request body
    const body = await request.json();
    const { tenantId, publicKey, privateKeyShare } = body;

    // Validate required fields
    if (!tenantId || !publicKey || !privateKeyShare) {
      throw new ValidationError("tenantId, publicKey, and privateKeyShare are required");
    }

    log.debug("Replicating tunnel keys to new passkey", {
      passkeyId,
      userId,
      tenantId,
    });

    // Verify that the passkey exists and belongs to the authenticated user
    const userPasskeys = await WebAuthnService.getUserPasskeys(userId);
    const targetPasskey = userPasskeys.find((p) => p.id === passkeyId);

    if (!targetPasskey) {
      throw new NotFoundError("Passkey not found or does not belong to you");
    }

    // Verify that the user has access to the tenant
    if (locals.user.tenantId !== tenantId) {
      throw new AuthorizationError("You do not have access to this tenant");
    }

    // Check if tunnel keys already exist for this passkey
    const staffCryptoService = new StaffCryptoService();
    const existingCrypto = await staffCryptoService.getStaffCryptoForPasskey(
      tenantId,
      userId,
      passkeyId,
    );

    if (existingCrypto) {
      log.warn("Tunnel keys already exist for this passkey - will overwrite", {
        passkeyId,
        userId,
        tenantId,
      });
    }

    // Store the re-encrypted tunnel keys
    await staffCryptoService.storeStaffKeypair(
      tenantId,
      userId,
      passkeyId,
      publicKey,
      privateKeyShare,
    );

    log.info("Tunnel keys replicated successfully", {
      passkeyId,
      userId,
      tenantId,
    });

    return json(
      {
        success: true,
        message: "Tunnel keys replicated successfully",
        passkeyId,
      },
      { status: 201 },
    );
  } catch (error) {
    log.error("Replicate tunnels error:", JSON.stringify(error || "?"));

    if (error instanceof NotFoundError) {
      return json({ error: error.message }, { status: 404 });
    }

    if (error instanceof ValidationError) {
      return json({ error: error.message }, { status: 400 });
    }

    if (error instanceof AuthorizationError) {
      return json({ error: error.message }, { status: 403 });
    }

    return json({ error: "Internal server error" }, { status: 500 });
  }
}

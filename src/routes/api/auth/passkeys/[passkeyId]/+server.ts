import { json, type RequestEvent } from "@sveltejs/kit";
import { UserService } from "$lib/server/services/user-service";
import { WebAuthnService } from "$lib/server/auth/webauthn-service";
import { StaffCryptoService } from "$lib/server/services/staff-crypto.service";
import { NotFoundError, ValidationError, AuthorizationError } from "$lib/server/utils/errors";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";

// Register OpenAPI documentation for DELETE
registerOpenAPIRoute("/auth/passkeys/{passkeyId}", "DELETE", {
  summary: "Delete a WebAuthn passkey from user account",
  description:
    "Allows authenticated users to delete one of their WebAuthn passkeys. Users cannot delete the passkey they are currently using for authentication.",
  tags: ["Authentication"],
  parameters: [
    {
      name: "passkeyId",
      in: "path",
      required: true,
      schema: { type: "string" },
      description: "The ID of the passkey to delete",
    },
  ],
  responses: {
    "200": {
      description: "Passkey deleted successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Success message" },
              deletedPasskeyId: { type: "string", description: "ID of the deleted passkey" },
            },
            required: ["message", "deletedPasskeyId"],
          },
          example: {
            message: "Passkey deleted successfully",
            deletedPasskeyId: "credential_id_123",
          },
        },
      },
    },
    "400": {
      description: "Cannot delete the currently active passkey",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "Cannot delete the passkey you are currently using" },
        },
      },
    },
    "401": {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "Authentication required" },
        },
      },
    },
    "403": {
      description: "Not authorized to delete this passkey",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "You can only delete your own passkeys" },
        },
      },
    },
    "404": {
      description: "Passkey not found",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "Passkey not found" },
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

export async function DELETE({ params, locals }: RequestEvent) {
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

    log.debug("Attempting to delete passkey", {
      passkeyId,
      userId,
    });

    // Get all passkeys for the user
    const userPasskeys = await WebAuthnService.getUserPasskeys(userId);

    // Check if passkey exists and belongs to the user
    const passkeyToDelete = userPasskeys.find((p) => p.id === passkeyId);

    if (!passkeyToDelete) {
      throw new NotFoundError("Passkey not found or does not belong to you");
    }

    // Check if this is the last passkey
    if (userPasskeys.length === 1) {
      throw new ValidationError("Cannot delete your last passkey");
    }

    // Check if this is the passkey being used for the current session
    // We need to get the session to check the passkeyId
    const sessionPayload = locals.user;
    if (sessionPayload?.passkeyId === passkeyId) {
      throw new ValidationError("Cannot delete the passkey you are currently using");
    }

    // Delete the passkey from the central database
    const deletedPasskey = await UserService.deletePasskey(passkeyId);

    if (!deletedPasskey) {
      throw new NotFoundError("Failed to delete passkey");
    }

    log.info("Passkey deleted successfully", {
      passkeyId,
      userId,
      deviceName: deletedPasskey.deviceName,
    });

    // If user has a tenant (STAFF or TENANT_ADMIN), also delete associated crypto data
    if (locals.user.tenantId) {
      const tenantId = locals.user.tenantId;

      try {
        const staffCryptoService = new StaffCryptoService();
        const deleted = await staffCryptoService.deleteStaffCryptoForPasskey(
          tenantId,
          userId,
          passkeyId,
        );

        log.debug("Staff crypto deletion completed", {
          passkeyId,
          userId,
          tenantId,
          deleted,
        });
      } catch (error) {
        // Log but don't fail the request - the passkey is already deleted
        log.warn("Failed to delete staff crypto data for passkey", {
          passkeyId,
          userId,
          tenantId,
          error: String(error),
        });
      }
    }

    return json(
      {
        message: "Passkey deleted successfully",
        deletedPasskeyId: passkeyId,
      },
      { status: 200 },
    );
  } catch (error) {
    log.error("Delete passkey error:", JSON.stringify(error || "?"));

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
